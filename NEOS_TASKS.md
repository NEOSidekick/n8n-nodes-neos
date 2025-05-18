Requirements Document – NEOS Package “Webhooks”

Purpose: Enable first-class creation, listing, deletion, and health-checking of outbound webhooks for NEOS CMS signals so that automation platforms (e.g. n8n) can self-register instead of relying on manual URL entry.

⸻

1. Scope

Implement a Flow-package Neos.Webhooks that:
	1.	Accepts REST calls to register / manage webhooks.
	2.	Persists definitions in the database and caches them in memory for sub-millisecond dispatch.
	3.	Dispatches the seven Content-Repository signals to every active target exactly once in <100 ms.
	4.	Guarantees delivery order per target (FIFO).
	5.	Secures every request with HMAC-SHA256 signatures & Access-Token header.

⸻

2. Definitions

Term	Meaning
Webhook	Combination of { id, targetUrl, subscribedEvents[], secret, isActive, createdAt }.
Handshake	First POST from NEOS to targetUrl containing header X-Webhook-Secret (plain secret) expecting HTTP 200 to activate.
Event	One of `‘nodeUpdated’


⸻

3. Actors & Authentication

Actor	Role
Automation Platform (e.g. n8n)	Calls REST API to register a webhook; receives events.
NEOS Admin	Can list / delete / pause webhooks in UI or CLI.

REST authentication – HTTP header Authorization: Bearer <personalAccessToken> issued via Flow’s UserService.
Outbound authenticity – Header X-Webhook-Signature: sha256=<hex> where <hex> = HMAC_SHA256(secret, rawBody).

⸻

4. Functional Requirements

4.1 REST Endpoints (JSON, versioned under /neos/api/webhooks/v1)

Method	Path	Body / Params	Success (HTTP 2xx)	Failure (HTTP 4xx/5xx)
POST	/webhooks	{ targetUrl: string, events?: string[] }• events default = all 7	201 Created → { id, targetUrl, events, secret }	400 invalid URL, 409 duplicate
GET	/webhooks	—	200 OK → array of Webhook DTOs	
GET	/webhooks/{id}	—	200 OK → DTO	404
DELETE	/webhooks/{id}	—	204 No Content	404
PATCH	/webhooks/{id}	{ isActive?: bool, events?: string[] }	200 OK → updated DTO	404, 400
POST	/webhooks/{id}/ping	—	202 Accepted; async ping job scheduled	404

4.2 Handshake Flow
	1.	After POST /webhooks, server stores record with isActive=false.
	2.	Immediately POST { "handshake": true } to targetUrl with header X-Webhook-Secret.
	3.	On HTTP 200 response within 3 s → set isActive=true. Non-200 or timeout → retry 3× with back-off then mark status="failed". Admin UI shows error badge.

4.3 Event Dispatch
	•	For each subscribed event:
	•	Build payload per spec; include timestamp at dispatch time.
	•	Sign body → X-Webhook-Signature.
	•	POST; on network error or non-2xx response queue retry (exponential back-off, 24 h TTL).
	•	Queue backend: Use Flow JobQueue (default database driver) or Redis when configured.
	•	Parallelism: Max 4 concurrent deliveries per target; FIFO per target ensured via queue naming.

4.4 Admin UI
	•	New module “Webhooks” under Settings.
	•	Table view: columns URL, Events, Status (Active/Failed/Paused), Last Error, Created.
	•	Actions: Add, Edit, Delete, Pause/Resume, Ping.
	•	Form wizard validates URL (https only).
	•	Live log tail (WebSocket) for troubleshooting.

4.5 CLI

./flow webhooks:list
./flow webhooks:add <url> --events nodeUpdated,nodeRemoved
./flow webhooks:delete <id>
./flow webhooks:pause <id>
./flow webhooks:resume <id>
./flow webhooks:ping <id>


⸻

5. Data Model (Doctrine + PHP)

/**
 * @Entity
 * @Table(name="neos_webhook")
 */
class Webhook {
    /** @Id @Column(type="guid") **/
    protected string $id;

    /** @Column(type="string") **/
    protected string $targetUrl;

    /** @Column(type="json") **/
    protected array $events = [];

    /** @Column(type="string") **/
    protected string $secret; // 32-byte random hex

    /** @Column(type="boolean") **/
    protected bool $isActive = false;

    /** @Column(type="datetime_immutable") **/
    protected \DateTimeImmutable $createdAt;

    /** @Column(type="string", nullable=true) **/
    protected ?string $lastError = null;
}


⸻

6. Non-Functional Requirements

Category	Requirement
Performance	Emit ≤100 ms overhead per signal at p95 under 50 events/s.
Security	• TLS 1.2+ enforced for outgoing URLs.• Signatures verified by consumers.• REST endpoints protected by AuthZ (role Neos.Webhook.Admin).
Scalability	Horizontal-safe: no global locks; JobQueue prefix by instance.
Reliability	Retry strategy: 1 min, 15 min, 1 h, 4 h; fail after 24 h.
Audit	Persist every attempt (status, httpCode, durationMs) for 14 days; viewable in UI.
Observability	Expose Prometheus metrics: neos_webhook_dispatch_total, neos_webhook_fail_total, neos_webhook_latency_ms.
Testing	100 % automated unit coverage for Controller & Service; Integration tests with dockerised mock server recording requests.


⸻

7. Implementation Milestones
	1.	Week 1 – Entity, Repository, Service skeleton + random secret generator.
	2.	Week 2 – REST Controller + Flow routes + unit tests.
	3.	Week 3 – Handshake worker + JobQueue wiring.
	4.	Week 4 – Signal-to-queue publisher (Signals.yaml + Slots).
	5.	Week 5 – Dispatcher worker, retry logic, signature header.
	6.	Week 6 – Admin UI (React + Fusion) + CLI tooling.
	7.	Week 7 – Prometheus metrics, audit log viewer, hardening.
	8.	Week 8 – End-to-end load test, docs, release.

⸻

8. Acceptance Criteria
	•	Creating a webhook via REST returns 201 with secret.
	•	Handshake activates webhook and UI shows Active.
	•	Firing nodePublished results in exactly one outbound POST containing correct JSON + valid HMAC.
	•	Paused webhooks receive zero deliveries.
	•	Deleting a webhook stops all future posts and clears queue.
	•	Failure scenarios (network error) visible in UI with retry count.
	•	All unit tests pass; p95 dispatch latency <100 ms in staging under 50 events/s.
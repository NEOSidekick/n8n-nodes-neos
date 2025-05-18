Below is a very, very, very detailed plan broken down into user stories. Each user story is further divided into one-story-point tasks with unchecked checkboxes. You can tick these off as you complete them. This list is exhaustive to ensure a highly competent AI coding agent can autonomously build the integration without missing any steps.

⸻

User Story 1: Initial Research & Project Setup

Goal: Prepare the development environment, gather requirements, and ensure a base to start coding the NEOS CMS <-> n8n integration.
1. [x]	Task 1.1: Verify Node.js and npm versions
•	Ensure the environment uses a compatible Node.js version for n8n development (e.g., Node 18+).
•	Confirm npm or yarn are installed.
2. [x]	Task 1.2: Fork/clone n8n repository (User-dependent, assumed working with current project structure)
•	Pull the main or the relevant development branch to start building the custom node.
3. [x]	Task 1.3: Create a dedicated branch (e.g. feature/neos-cms-integration) (User-dependent)
•	Keep all changes separate and version-controlled.
4. [x]	Task 1.4: Explore NEOS CMS's documentation for signals & webhooks (Research, will use info from later tasks)
•	Confirm how each signal (nodeUpdated, nodeAdded, nodeRemoved, etc.) can be emitted.
•	Verify the default payload structure for each signal.
5. [x]	Task 1.5: Outline the node's purpose in nodes/Neos
•	Decide on the main approach: A "Trigger Node" for NEOS events plus optional "Action Node" if needed.
6. [x]	Task 1.6: Validate the approach to access tokens (To be detailed in User Story 5) -> one token per Neos instance.
•	Decide if using a single token for all triggers or different tokens per user.
•	Map how NEOS CMS will inject the token into the outgoing webhook.
7. [x]	Task 1.7: Confirm any TypeScript guidelines (ESLint, Prettier)
•	Make sure to follow the same style used in the n8n project.
8. [x]	Task 1.8: Prepare local environment to run and debug n8n (User-dependent for full n8n; package scripts noted)
•	Build n8n from source.
•	Start n8n in local dev mode to test changes instantly.

⸻

User Story 2: Designing the NEOS CMS Node Type & File Structure

Goal: Define how the NEOS node type will appear in n8n's UI (display name, icon, etc.) and plan the code layout.
1. [x]	Task 2.1: Create neos.svg icon in nodes/Neos/
•	Use NEOS official logo if licensing allows or a custom placeholder.
•	SVG dimensions ~ 60×60 px.
2. [ ]	Task 2.2: Create Neos.node.json describing node metadata (if needed)
•	Follow the pattern from Asana.node.json.
3. [ ]	Task 2.3: Create NeosTrigger.node.ts file
•	Mimic the AsanaTrigger structure.
•	Put at nodes/Neos/NeosTrigger.node.ts.
4. [ ]	Task 2.4: Insert the INodeTypeDescription with the following keys:

description: INodeTypeDescription = {
displayName: 'Neos CMS',
name: 'neos',
icon: 'file:neos.svg',
...
};

	•	Confirm all standard fields: version, group, defaults, etc.

	5. [ 	Task 2.5: Decide which credentials type to use
	•	Possibly NeosApi with an Access Token field or basic OAuth flow if NEOS supports it.
	6. [ 	Task 2.6: Add placeholders for each of the signals in the properties array
	•	nodeUpdated, nodeAdded, nodeRemoved, nodePropertyChanged, nodePublished, nodeDiscarded, afterNodePublishing.
	7. [ 	Task 2.7: Discuss naming for the Resource + Operation model
	•	Alternatively, name them "Events" or "Trigger Type."
	•	Possibly treat each signal as an event type in a single "Trigger" operation.

⸻

User Story 3: Implementing the NEOS CMS Trigger Node Structure

Goal: Set up the NeosTrigger class to handle incoming webhooks from NEOS for each specified event.
1. [ ]	Task 3.1: Extend INodeType in NeosTrigger.node.ts
•	Provide the description property with triggers.
2. [ ]	Task 3.2: Set up webhooks: [...] array in the node's description
•	At least one item: name: 'default', httpMethod: 'POST', path: 'webhook', responseMode: 'onReceived'.
3. [ ]	Task 3.3: Implement webhookMethods object with checkExists, create, delete
•	For now, you can skip actual calls to NEOS to register the webhook. NEOS might not natively register webhooks from external. Instead, keep the placeholders or no-ops if NEOS is push-only.
4. [ ]	Task 3.4: Implement async webhook(this: IWebhookFunctions) method
•	Retrieve bodyData (this.getBodyData()).
•	Retrieve headerData (this.getHeaderData()).
•	Validate access_token.
5. [ ]	Task 3.5: Store webhookId if needed in workflowStaticData
•	Since NEOS triggers might not confirm externally, this may remain empty or store a random ID.
6. [ ]	Task 3.6: Return workflowData with the parsed event
•	Example:

return {
workflowData: [this.helpers.returnJsonArray(req.body as IDataObject[])]
};


	7. [ 	Task 3.7: Add logic to parse the NEOS event type from body
	•	E.g., event: bodyData.signalName.
	•	Expose it as JSON output: nodeIdentifier, nodeProperties, etc.
	8. [ 	Task 3.8: Write a robust test in local environment
	•	Use a dummy POST request with cURL or Postman to confirm the node triggers.

⸻

User Story 4: Handling All NEOS Signals (Mapping & Fields)
Updated User Story 4 – Handling All NEOS Signals (Mapping & Fields)

Goal: Parse every NEOS signal, transform its exact argument list into a JSON payload, and expose those keys as output fields in the Neos CMS Trigger node.

#	One-story-point Task	✓
4.1	Define TypeScript interface NeosWebhookPayload with optional keys:ts<br>interface NeosWebhookPayload {<br>  event: NeosSignal;            // "nodeUpdated", …<br>  nodeIdentifier: string;       // always present<br>  workspace?: string;           // for all Node-based events<br>  contextPath?: string;         // Node::getContextPath()<br>  propertyName?: string;        // only nodePropertyChanged<br>  oldValue?: any;               // 〃<br>  newValue?: any;               // 〃<br>  targetWorkspace?: string;     // publish / afterNodePublishing<br>  timestamp: string;            // ISO-8601<br>}<br>	[ ]
4.2	nodeUpdated — map one-argument signalphp<br>$payload = [..., 'event'=>'nodeUpdated',<br> 'workspace'=>$node->getWorkspace()->getName(),<br> 'contextPath'=>$node->getContextPath()];<br>Add Jest unit test to assert required keys. [ ]	[ ]
4.3	nodeAdded — identical mapping to nodeUpdated; verify unit test passes distinct event value. [ ]	[ ]
4.4	nodeRemoved — same mapping; add comment that the identifier is still valid pre-delete. [ ]	[ ]
4.5	nodePropertyChanged — extend mapping with propertyName, oldValue, newValue; write test that array-filtered payload omits nulls for other events. [ ]	[ ]
4.6	nodePublished — add targetWorkspace from second argument; ensure workspace (source), targetWorkspace (dest) both present. [ ]	[ ]
4.7	nodeDiscarded — single-workspace argument; include only nodeIdentifier, workspace, timestamp. [ ]	[ ]
4.8	afterNodePublishing — clone mapping from nodePublished; verify emitted after publish in functional test. [ ]	[ ]
4.9	Update webhook() parser: iterate over body.event; dynamically build n8n item with all present keys, preserving types (string vs any). [ ]	[ ]
4.10	Expose output descriptions in node properties:- event (string) – one of the seven signals- nodeIdentifier (string)- workspace (string)- contextPath (string)- propertyName (string)- oldValue/newValue (mixed)- targetWorkspace (string)- timestamp (string, ISO-8601)Update displayOptions so fields appear only when present. [ ]	[ ]
4.11	Add switch-node recipe to docs: demonstrate branching on event value. [ ]	[ ]
4.12	Validate payload size (<32 KB) after filtering nulls; add safeguard to truncate enormous oldValue/newValue (>4 KB). [ ]	[ ]
4.13	Ensure access-token check precedes payload parsing; unit test rejects missing/invalid header. [ ]	[ ]
4.14	Update README examples with concrete JSON for each signal reflecting the new schema. [ ]	[ ]
4.15	Run end-to-end smoke tests: Post sample payloads for all seven events; confirm n8n workflow receives correct keys and values. [ ]	[ ]
⸻

User Story 5: Access Token Authentication & Verification

Goal: Secure the integration so that random requests cannot spam n8n's workflow.
1. [ ]	Task 5.1: Decide credential name (e.g. neosApi) in credentials array of the node.
•	Possibly 'neosApi': { ... }.
2. [ ]	Task 5.2: Create a new credential file (e.g. NeosApi.credentials.ts)
•	Implement ICredentialType.
•	Fields: accessToken, hostUrl (if needed).
3. [ ]	Task 5.3: Add to node's credentials property:

credentials: [
{
name: 'neosApi',
required: true
}
]


	4. [ 	Task 5.4: In webhook() method, retrieve the stored token from this.getCredentials('neosApi').
	•	Example: const { accessToken } = this.getCredentials('neosApi') as { accessToken: string };
	5. [ 	Task 5.5: Compare accessToken with the headerData['access_token'] or query param.
	•	If mismatch → throw NodeOperationError with 401 status.
	6. [ 	Task 5.6: Write fallback logic if the user wants no auth (optional).
	•	Possibly a user config that disables token check.
	7. [ 	Task 5.7: Provide user instructions on retrieving the token from NEOS.
	•	This might be a manual step if NEOS requires configuration.
	8. [ 	Task 5.8: Test end-to-end with a random token:
	•	Good token → triggers the workflow.
	•	Bad token → returns 401/403.

⸻

User Story 6: Node Configuration & UI Options

Goal: Let users choose how they want to filter or handle the events once the node triggers.
1. [ ]	Task 6.1: Add a resource name 'Webhook' or 'Event' in properties[].
•	Possibly resource: 'webhook' and operation: 'subscribe'| 'unsubscribe'.
•	Or a single 'trigger' operation.
2. [ ]	Task 6.2: Add a string or multi-option parameter for Signal Types
•	e.g. [nodeUpdated, nodeAdded, nodeRemoved, ...].
3. [ ]	Task 6.3: If the user wants to selectively handle signals, store that in webhookData.
•	Then in the webhook() method, we can skip triggers not in the user's selection (optional).
4. [ ]	Task 6.4: Add any "Additional Fields" the user might want, e.g. concurrency or advanced filtering.
•	This can be done with a type: 'collection', placeholder: 'Add Field'.
5. [ ]	Task 6.5: Validate that the new UI parameters appear properly in n8n's node editor.
•	Start n8n in local dev mode, add the "Neos CMS Trigger" node, confirm the dropdowns.

⸻

User Story 7: Handling NEOS → n8n Webhook Creation (If the CMS Supports Registration)

Goal: If the NEOS CMS supports dynamic webhook registration, replicate the Asana approach. If not, keep placeholders.
1. [ ]	Task 7.1: Investigate NEOS documentation for registering external webhook URLs.
•	If possible, do a POST /neos/api/webhooks with targetURL and events.
2. [ ]	Task 7.2: If not available, proceed with a manual config approach.
•	That means the user sets the n8n webhook URL directly in NEOS.
3. [ ]	Task 7.3: If dynamic is possible, implement the create() method under webhookMethods.default.
•	Build the request to NEOS with the selected events + the webhookUrl.
4. [ ]	Task 7.4: Implement the checkExists() method to see if the NEOS webhook already exists.
•	e.g. GET /neos/api/webhooks to see if a matching targetUrl is found.
5. [ ]	Task 7.5: Implement the delete() method to remove or disable the registration.
•	e.g. DELETE /neos/api/webhooks/:id
6. [ ]	Task 7.6: If NEOS does not support deletion, return true with a no-op.

⸻

User Story 8: Testing & QA

Goal: Ensure the node, triggers, and access token logic work in real or simulated scenarios.
1. [ ]	Task 8.1: Write unit tests for the NEOS CMS Trigger node (if the n8n environment supports them).
•	Check correct parsing of sample payloads.
2. [ ]	Task 8.2: Write an integration test with cURL or Postman to the local webhook endpoint.
•	Post a mock "nodePublished" event with valid access_token.
3. [ ]	Task 8.3: Post the same payload with invalid or missing token → expect 401.
•	Confirm security.
4. [ ]	Task 8.4: Test each NEOS signal type individually.
•	nodeUpdated, nodeAdded, etc. Make sure each is properly recognized.
5. [ ]	Task 8.5: Check the log for any unhandled errors or exceptions.
•	Fix as needed.
6. [ ]	Task 8.6: Validate that n8n stops or continues based on the workflow's logic.
•	For instance, if a user's workflow branches on event = nodeRemoved, confirm it triggers the correct branch.
7. [ ]	Task 8.7: Evaluate concurrency or performance (if many signals come at once).
•	Possibly consider a "Queue" or concurrency settings in n8n.

⸻

User Story 9: Documentation & Sample Usage

Goal: Provide thorough instructions so users and the AI agent know how to configure everything.
1. [ ]	Task 9.1: Create or update README.md in the nodes/Neos/ folder
•	Quick overview of the NEOS CMS integration.
2. [ ]	Task 9.2: Document "How to Set the Webhook in NEOS"
•	Step-by-step for the user: "Go to NEOS backend, set the URL to https://<n8n-host>/webhook/neos…"
3. [ ]	Task 9.3: Document "How to Add Credentials in n8n"
•	Where to find or create the accessToken in NEOS.
•	Steps in the n8n Credential editor.
4. [ ]	Task 9.4: Provide examples for each signal event and the JSON fields received.
•	E.g., nodePublished:

{
"signalName": "nodePublished",
"nodeIdentifier": "12345-abc",
...
}


	5. [ 	Task 9.5: Add screenshots of the node configuration in n8n.
	•	Show the user how to drag & drop, set up event filters.
	6. [ 	Task 9.6: Publish these docs as a Confluence page or in the official n8n docs if relevant.

⸻

User Story 10: Final Review & Release

Goal: Clean up code, finalize, and merge into main for distribution.
1. [ ]	Task 10.1: Run final lint & build checks
•	npm run lint / npm run build in the n8n repository root.
2. [ ]	Task 10.2: Review the code with a pull request or local diff
•	Check if everything matches project style guidelines.
3. [ ]	Task 10.3: Confirm that all placeholders for dynamic webhook creation are either removed or well-documented.
•	If NEOS can't do external registration, mark it clearly.
4. [ ]	Task 10.4: Merge the feature/neos-cms-integration branch into main (or release branch).
•	Tag or label the release in version control.
5. [ ]	Task 10.5: Verify the new node is included in a built version of n8n.
•	Test with a local or staging environment.
6. [ ]	Task 10.6: Communicate release notes:
•	"Added NEOS CMS Trigger node supporting signals: nodeUpdated, nodeAdded, nodeRemoved, nodePropertyChanged, nodePublished, nodeDiscarded, afterNodePublishing."
7. [ ]	Task 10.7: Solicit feedback from NEOS CMS developers or community for improvements.

⸻

This plan ensures every micro-step (from environment setup, to code design, triggers, testing, token security, doc finalization, and release) is covered. Checking off each item systematically will deliver a robust n8n integration for NEOS CMS events!

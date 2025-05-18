import crypto from 'crypto'; // For HMAC validation
import type {
	IHookFunctions,
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	// ICredentialsDecrypted, // Not strictly needed if we cast to our own interface directly
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow'; // Removed NodeOperationError
import { neosApiRequest } from './GenericFunctions';
// Removed self-imports for INeosApiCredentialsData, NeosSignal, NeosWebhookPayload as they are defined below

// Define Neos Signal Types and Payload Structure (User Story 4.1)
export type NeosSignal =
	| 'nodeUpdated'
	| 'nodeAdded'
	| 'nodeRemoved'
	| 'nodePropertyChanged'
	| 'nodePublished'
	| 'nodeDiscarded'
	| 'afterNodePublishing';

export interface NeosWebhookPayload extends IDataObject {
	event: NeosSignal;
	nodeIdentifier: string;
	workspace?: string;
	contextPath?: string;
	propertyName?: string;
	oldValue?: any;
	newValue?: any;
	targetWorkspace?: string;
	timestamp: string; // ISO-8601
}

// Max length for oldValue/newValue strings (Task 4.12)
const MAX_VALUE_LENGTH = 4000; // Approx 4KB, simple char count
const TRUNCATION_MESSAGE = '[TRUNCATED DUE TO LENGTH]';

// Placeholder for any generic functions we might need later, similar to Asana's GenericFunctions.ts
// For now, direct implementation or simple helpers can be within this file.

// Define structure for Neos API credentials data
export interface INeosApiCredentialsData {
	neosInstanceUrl?: string;
	accessToken: string;
}

interface NeosWebhookRegistrationData {
    id: string;
    targetUrl: string;
    events: NeosSignal[];
    secret: string; // This is the HMAC secret from Neos for payload signing
    isActive: boolean;
    createdAt: string;
}

export class NeosTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Neos CMS Trigger',
		name: 'neosTrigger',
		icon: 'file:neos.svg',
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when Neos CMS events occur.',
		defaults: {
			name: 'Neos CMS Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'neosApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			// This will be the Neos API Credentials, defined in User Story 5
			// For now, the credential definition in the `credentials` array above is the main placeholder.

			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{ name: 'After Node Publishing', value: 'afterNodePublishing' },
					{ name: 'Node Added', value: 'nodeAdded' },
					{ name: 'Node Discarded', value: 'nodeDiscarded' },
					{ name: 'Node Property Changed', value: 'nodePropertyChanged' },
					{ name: 'Node Published', value: 'nodePublished' },
					{ name: 'Node Removed', value: 'nodeRemoved' },
					{ name: 'Node Updated', value: 'nodeUpdated' },
				],
				default: [],
				required: true,
				description: 'The Neos CMS events to listen for',
			},
			// Placeholder for a resource ID if Neos webhooks are specific to a resource (e.g. site/workspace)
			// {
			// 	displayName: 'Site Identifier',
			// 	name: 'siteId',
			// 	type: 'string',
			// 	default: '',
			// 	placeholder: 'default',
			// 	description: 'Optional: ID of the site/workspace to filter events for. Leave empty for all.',
			// },
		],
	};

	// Mimicking AsanaTrigger structure for webhook methods
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const selectedEvents = this.getNodeParameter('events', []) as NeosSignal[];

				try {
					const webhooks = await neosApiRequest.call(this, 'GET', '/webhooks') as NeosWebhookRegistrationData[] | null;
					if (webhooks && webhooks.length > 0) {
						for (const webhook of webhooks) {
							// Check if targetUrl matches and events substantially overlap or match
							// A simple equality check for events array might be too strict if order differs or Neos returns a subset/superset.
							// For now, let's assume if targetUrl matches, we manage this webhook.
							// A more robust check would compare event arrays regardless of order.
							if (webhook.targetUrl === webhookUrl) {
								// Check if the events match (order-agnostic comparison)
								const remoteEventsSet = new Set(webhook.events);
								const localEventsSet = new Set(selectedEvents);
								const eventsMatch = remoteEventsSet.size === localEventsSet.size && [...remoteEventsSet].every(event => localEventsSet.has(event));

								if (eventsMatch) {
									webhookData.webhookId = webhook.id;
									webhookData.hmacSecret = webhook.secret; // Store HMAC secret from Neos
									console.log(`Neos Trigger: Found existing active webhook ID: ${webhook.id}`);
									return true;
								}
							}
						}
					}
				} catch (error) {
					// Log error but don't fail node activation if API call fails, allow creation attempt
					console.error('Neos Trigger: Error checking for existing webhooks:', error.message);
				}
				// If no matching webhook is found, or an error occurred, allow creation attempt
				delete webhookData.webhookId;
				delete webhookData.hmacSecret;
				delete webhookData.handshakeSecret; // Clear any old handshake secret
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const events = this.getNodeParameter('events', []) as NeosSignal[];
				const webhookData = this.getWorkflowStaticData('node');

				const body = {
					targetUrl: webhookUrl,
					events: events.length > 0 ? events : undefined, // Send events if specified, otherwise Neos defaults to all
				};

				try {
					const response = await neosApiRequest.call(this, 'POST', '/webhooks', body) as NeosWebhookRegistrationData;
					if (response && response.id && response.secret) {
						webhookData.webhookId = response.id;
						webhookData.hmacSecret = response.secret; // Store HMAC secret from Neos creation response
						console.log(`Neos Trigger: Successfully created webhook. ID: ${response.id}. Waiting for handshake.`);
						// Handshake will occur when Neos POSTs to webhookUrl with X-Webhook-Secret
						// The webhookData.handshakeSecret will be set then.
						return true;
					}
					console.error('Neos Trigger: Webhook creation response missing id or secret.', response);
					return false;
				} catch (error) {
					console.error('Neos Trigger: Failed to create webhook:', error.message);
					// Simplified error handling for create: if it fails (e.g. 409), checkExists should have caught it or will on next activation.
					return false;
				}
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId) {
					try {
						await neosApiRequest.call(this, 'DELETE', `/webhooks/${webhookData.webhookId}`);
						console.log(`Neos Trigger: Successfully deleted webhook ID: ${webhookData.webhookId}`);
					} catch (error) {
						console.error(`Neos Trigger: Failed to delete webhook ID: ${webhookData.webhookId}`, error.message);
						// Don't return false if deletion fails, as the webhook might already be gone or unrecoverable.
						// n8n will still deactivate the workflow locally.
					}
				}
				delete webhookData.webhookId;
				delete webhookData.hmacSecret;
				delete webhookData.handshakeSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const res = this.getResponseObject();
		const bodyData = this.getBodyData() as NeosWebhookPayload | { handshake: boolean };
		const headerData = this.getHeaderData() as IDataObject;
		const webhookData = this.getWorkflowStaticData('node');

		// Handle Neos Webhook Handshake (NEOS_TASKS.md, Section 4.2)
		const handshakeSecretFromNeos = headerData['x-webhook-secret'] as string | undefined;
		if (handshakeSecretFromNeos && (bodyData as { handshake: boolean }).handshake === true) {
			webhookData.handshakeSecret = handshakeSecretFromNeos;
			// The webhookData.hmacSecret should have been set during create()
			// This handshakeSecret might be the same as hmacSecret, or different. NEOS_TASKS.md says POST /webhooks returns {secret}
			// and handshake POSTs X-Webhook-Secret. Assuming they are distinct for now, but if they are the same, hmacSecret is the one to keep for signing.
			// For now, we just acknowledge the handshake for activation.
			console.log('Neos Trigger: Received handshake request. Storing handshake secret. Responding 200 OK.');
			res.status(200).send('Webhook handshake received and acknowledged.');
			return { noWebhookResponse: true };
		}

		// Regular event processing: Validate HMAC signature (NEOS_TASKS.md, Section 3)
		if (!webhookData.hmacSecret) {
			console.error('Neos Trigger: HMAC secret not found in webhook static data. Cannot validate payload.');
			res.status(500).send('HMAC secret configuration error.');
			return { noWebhookResponse: true };
		}
		const neosSignature = headerData['x-webhook-signature'] as string | undefined;
		if (!neosSignature || !neosSignature.startsWith('sha256=')) {
			console.warn('Neos Trigger: Missing or invalid X-Webhook-Signature header.');
			res.status(400).send('Missing or invalid X-Webhook-Signature header.');
			return { noWebhookResponse: true };
		}

		const rawBody = (req as any).rawBody || JSON.stringify(this.getBodyData()); // Try req.rawBody or stringified parsed body
		const expectedSignature = `sha256=${crypto.createHmac('sha256', webhookData.hmacSecret as string).update(rawBody).digest('hex')}`;

		if (!crypto.timingSafeEqual(Buffer.from(neosSignature), Buffer.from(expectedSignature))) {
			console.warn('Neos Trigger: Invalid X-Webhook-Signature. Payload may be tampered or secret mismatch.');
			res.status(403).send('Invalid X-Webhook-Signature.');
			return { noWebhookResponse: true };
		}
		console.log('Neos Trigger: X-Webhook-Signature validated successfully.');

		// Removed neosApiCredentials retrieval as it's for outgoing calls, not validating incoming Neos webhooks if HMAC is good.

		const eventPayload = bodyData as NeosWebhookPayload;
		const selectedEvents = this.getNodeParameter('events', []) as string[];
		const eventType = eventPayload.event;

		if (!eventType) {
			console.log('Neos Trigger: Received webhook but no event type (event field) found in payload after signature check.');
			res.status(400).send('Missing event type in payload.');
			return { noWebhookResponse: true };
		}

		if (selectedEvents.length > 0 && !selectedEvents.includes(eventType)) {
			console.log(`Neos Trigger: Event '${eventType}' received and validated, but not in selected list. Sending 200 OK.`);
			res.status(200).send(`Event '${eventType}' received but not processed as per node configuration.`);
			return { noWebhookResponse: true };
		}

		const processedBodyData = { ...eventPayload };
		if (typeof processedBodyData.oldValue === 'string' && processedBodyData.oldValue.length > MAX_VALUE_LENGTH) {
			processedBodyData.oldValue = processedBodyData.oldValue.substring(0, MAX_VALUE_LENGTH) + TRUNCATION_MESSAGE;
		}
		if (typeof processedBodyData.newValue === 'string' && processedBodyData.newValue.length > MAX_VALUE_LENGTH) {
			processedBodyData.newValue = processedBodyData.newValue.substring(0, MAX_VALUE_LENGTH) + TRUNCATION_MESSAGE;
		}

		console.log(`Neos Trigger: Processing event '${eventType}'. Payload:`, JSON.stringify(processedBodyData));

		return {
			workflowData: [this.helpers.returnJsonArray([processedBodyData])],
		};
	}
}

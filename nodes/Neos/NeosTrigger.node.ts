import type {
	IHookFunctions,
	IWebhookFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

// Placeholder for any generic functions we might need later, similar to Asana's GenericFunctions.ts
// For now, direct implementation or simple helpers can be within this file.

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
				name: 'neosApi', // To be defined in User Story 5
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
				// User Story 7: If Neos supports dynamic webhook registration, this checks if a webhook exists.
				// For now, assume manual setup or always return false to attempt creation.
				// const webhookData = this.getWorkflowStaticData('node');
				// if (webhookData.webhookId) { return true; }
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				// User Story 7: If Neos supports dynamic webhook registration, this creates the webhook.
				// For now, assume manual setup in Neos by user. Store a dummy ID or simply return true.
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				// const webhookData = this.getWorkflowStaticData('node');
				// webhookData.webhookId = `dummy_neos_webhook_${Date.now()}`;
				console.log(`Neos Trigger: Webhook URL to be configured in Neos: ${webhookUrl}`);
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				// User Story 7: If Neos supports dynamic webhook registration, this deletes the webhook.
				// For now, assume manual setup or simply clear any stored dummy data.
				// const webhookData = this.getWorkflowStaticData('node');
				// delete webhookData.webhookId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const bodyData = this.getBodyData() as IDataObject;
		const headerData = this.getHeaderData() as IDataObject;

		// User Story 5: Access token validation will go here.
		// For now, log the received token if present.
		const receivedToken = headerData['x-access-token'] || req.query.access_token;
		if (receivedToken) {
			console.log(`Neos Trigger: Received access token (length: ${receivedToken.toString().length})`);
		} else {
			console.log('Neos Trigger: No access token received in headers (x-access-token) or query (access_token).');
			// Depending on policy, might throw new NodeOperationError(this.getNode(), 'Missing access token', { statusCode: 401 });
		}

		// User Story 3 & 4: Payload parsing and event filtering will go here.
		// For now, just return the whole body if it looks like it has an event.

		const selectedEvents = this.getNodeParameter('events', []) as string[];
		const eventType = bodyData.event as string || bodyData.signalName as string;

		if (!eventType) {
			console.log('Neos Trigger: Received webhook but no event type (event/signalName) found in payload.');
			return {}; // No event to process
		}

		if (selectedEvents.length > 0 && !selectedEvents.includes(eventType)) {
			console.log(`Neos Trigger: Received event '${eventType}' but it is not in the selected list of events to process.`);
			return {}; // Event not in the list user wants to process
		}

		console.log(`Neos Trigger: Processing event '${eventType}'. Payload:`, JSON.stringify(bodyData));

		// Structure of the returned data should be an array of events/items.
		// If bodyData itself is the event, wrap it in an array.
		// If bodyData contains a list of events (e.g., bodyData.events), use that directly.
		// Assuming bodyData is a single event object for now.
		return {
			workflowData: [this.helpers.returnJsonArray([bodyData])],
		};
	}
}

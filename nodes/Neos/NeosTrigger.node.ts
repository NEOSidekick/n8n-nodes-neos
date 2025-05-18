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
interface INeosApiCredentialsData {
	neosInstanceUrl?: string;
	accessToken: string;
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
		const res = this.getResponseObject();
		const bodyData = this.getBodyData() as NeosWebhookPayload;
		const headerData = this.getHeaderData() as IDataObject;

		let neosApiCredentials: INeosApiCredentialsData;
		try {
			// Cast directly to our specific interface
			neosApiCredentials = await this.getCredentials('neosApi') as INeosApiCredentialsData;
		} catch (error) {
			console.error('Neos Trigger: Error retrieving credentials or credentials not assigned.', error);
			res.status(401).send('Neos API credentials are not configured or accessible.');
			return { noWebhookResponse: true };
		}

		// Check if credentials object or accessToken is missing (e.g. if credential was empty)
		if (!neosApiCredentials || typeof neosApiCredentials.accessToken !== 'string' || neosApiCredentials.accessToken === '') {
			console.log('Neos Trigger: Access token is not configured or empty in Neos API credentials.');
			res.status(401).send('Access token is not configured or empty in Neos API credentials.');
			return { noWebhookResponse: true };
		}
		const expectedToken = neosApiCredentials.accessToken;

		const receivedTokenHeader = headerData['x-access-token'] as string | undefined;
		const receivedTokenQuery = req.query.access_token as string | undefined;
		const receivedToken = receivedTokenHeader || receivedTokenQuery;

		if (!receivedToken) {
			console.log('Neos Trigger: Missing access token in webhook request.');
			res.status(401).send('Missing access token in webhook request.');
			return { noWebhookResponse: true };
		}

		if (receivedToken !== expectedToken) {
			console.log('Neos Trigger: Invalid access token.');
			res.status(403).send('Invalid access token.');
			return { noWebhookResponse: true };
		}

		console.log('Neos Trigger: Access token validated successfully.');

		const selectedEvents = this.getNodeParameter('events', []) as string[];
		const eventType = bodyData.event;

		if (!eventType) {
			console.log('Neos Trigger: Received webhook but no event type (event field) found in payload.');
			res.status(400).send('Missing event type in payload.');
			return { noWebhookResponse: true };
		}

		if (selectedEvents.length > 0 && !selectedEvents.includes(eventType)) {
			console.log(`Neos Trigger: Received event '${eventType}' but it is not in the selected list of events to process. Sending 200 OK to acknowledge receipt but not processing.`);
			res.status(200).send(`Event '${eventType}' received but not processed as per node configuration.`);
			return { noWebhookResponse: true };
		}

		const processedBodyData = { ...bodyData };
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

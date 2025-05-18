import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	// IWebhookResponseData, // Not used for a basic node
	// IHookFunctions, // Primarily for triggers or complex nodes
	// IWebhookFunctions, // Primarily for triggers
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

export class Neos implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Neos CMS',
		name: 'neos',
		icon: 'file:neos.svg',
		group: ['transform'], // Defaulting to 'transform', can be changed
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}', // Placeholder
		description: 'Interact with Neos CMS API (Placeholder for Actions)',
		defaults: {
			name: 'Neos CMS',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			// {
			// 	name: 'neosApi', // Example, will be defined in User Story 5
			// 	required: true,
			// },
		],
		properties: [
			// Placeholder properties for a generic action node
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Node',
						value: 'node',
					},
				],
				default: 'node',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['node'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get a node',
						action: 'Get a node',
					},
				],
				default: 'get',
			},
			{
				displayName: 'Node ID',
				name: 'nodeId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['node'],
						operation: ['get'],
					},
				},
				description: 'ID of the Neos node',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Minimal execute function for a placeholder action node
		const items = this.getInputData();
		const returnData: IDataObject[] = [];

		// Placeholder logic
		for (let i = 0; i < items.length; i++) {
			const nodeId = this.getNodeParameter('nodeId', i) as string;
			// In a real scenario, you would make an API call here
			// For now, just return some dummy data
			returnData.push({
				nodeId: nodeId,
				message: 'Placeholder execute method for Neos node',
				itemIndex: i,
				json: items[i].json,
			});
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}

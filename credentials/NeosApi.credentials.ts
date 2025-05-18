import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class NeosApi implements ICredentialType {
	name = 'neosApi';
	displayName = 'Neos CMS API';
	documentationUrl = 'https://docs.example.com/credentials/neosapi/'; // Placeholder
	properties: INodeProperties[] = [
		{
			displayName: 'Neos Instance URL',
			name: 'neosInstanceUrl',
			type: 'string',
			default: '',
			placeholder: 'https://www.your-neos-instance.com',
			description: 'Optional: The URL of your Neos CMS instance (for reference)',
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'The access token provided by Neos CMS for webhook authentication',
		},
	];
}

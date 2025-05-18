import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	JsonObject,
	IHttpRequestMethods,
	IRequestOptions,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type { INeosApiCredentialsData } from './NeosTrigger.node'; // Assuming INeosApiCredentialsData is exported or moved here

/**
 * Makes an API request to the Neos Webhooks API.
 *
 * @param this The context to use.
 * @param method The HTTP method to use.
 * @param endpoint The endpoint to call.
 * @param body The body to send.
 * @param qs Additional query string parameters.
 * @returns The response data.
 */
export async function neosApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
	let neosApiCredentials: INeosApiCredentialsData;
	try {
		neosApiCredentials = (await this.getCredentials('neosApi')) as INeosApiCredentialsData;
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			'Neos API credentials are not configured or accessible.',
		);
	}

	if (!neosApiCredentials?.neosInstanceUrl || !neosApiCredentials?.accessToken) { // Added optional chaining for safety
		throw new NodeOperationError(
			this.getNode(),
			'Neos Instance URL or Access Token is missing in Neos API credentials. Please configure them in the node credentials.',
		);
	}

	const baseUrl = neosApiCredentials.neosInstanceUrl.replace(/\/$/, '');
	const requestOptions: IRequestOptions = {
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${neosApiCredentials.accessToken}`,
		},
		method,
		body,
		qs,
		uri: `${baseUrl}/neos/api/webhooks/v1${endpoint}`,
		json: true, // Expect JSON response
	};

	try {
		const responseData = await this.helpers.request(requestOptions);
		return responseData;
	} catch (error) {
		if (error instanceof NodeApiError) {
			// Check for 409 Conflict from the context provided by this.helpers.request
			const statusCode = error.context?.httpStatusCode as number | undefined;
			if (statusCode === 409) {
				// Re-throw with a more specific message, preserving original context if it's JsonObject
				let contextForError: JsonObject = {};
				if (typeof error.context === 'object' && error.context !== null) {
					// Ensure that error.context is actually a JsonObject. If not, an empty object is used.
					// A more robust check might involve validating the structure of error.context if its shape is known.
					contextForError = error.context as JsonObject; // This cast might still be risky if error.context is not a valid JsonObject
				}
				throw new NodeApiError(this.getNode(), contextForError, { message: 'Webhook already exists on Neos (409 Conflict).' });
			}
			throw error; // Re-throw original NodeApiError if not 409 or context is not as expected
		}
		// For other types of errors, wrap them in NodeApiError
		const errorContext: JsonObject = {
			errorMessage: (error as Error).message,
			errorName: (error as Error).name,
			stack: (error as Error).stack ?? null, // Assign null if stack is undefined
		};
		throw new NodeApiError(this.getNode(), errorContext, { message: 'An unexpected error occurred during Neos API request.' });
	}
}

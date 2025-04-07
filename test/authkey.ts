import DocClient from '../src/client';

const API_BASE_URL = 'https://stage.document.no:3790';

(async () => {
	const client = new DocClient(API_BASE_URL, 'apikey-9XyZ7890KlMnP');
	const r = await client.get('/api/v1/whoami');
	console.log(JSON.stringify(r, undefined, 2));
	if (r.isSuccess()) {
		//
	} else {
		//
	}
})();

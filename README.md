# Doc API Client

Experimental client library for interacting with a doc-api REST API.

## Features

- Simplifies API interactions with `GET`, `POST`, `PUT`, and `DELETE` methods.
- Manages authentication tokens seamlessly, including token refresh.

## Installation

To use this package, install it via npm or yarn:

    npm install github:documentmedia/doc-api-client

or

    yarn add github:documentmedia/doc-api-client

## Usage

### Import and Initialize

    import DocClient from 'doc-api-client';

    const API_BASE_URL = 'https://api.example.com';
    const client = new DocClient(API_BASE_URL);

    Note: URL must have no trailing slash


### Public Methods

#### `login(username: string, password: string, domain: string, fingerprint: string): Promise<{ accessToken: string; refreshToken: string }>`

Authenticates the user and retrieves an access token and refresh token.

    await client.login('username', 'password', 'example.com', 'unique-fingerprint');

#### `get<T>(command: string): Promise<T>`

Performs a `GET` request to the specified API endpoint.

    const data = await client.get('/api/v1/resource');

#### `post<T>(command: string, body: any): Promise<T>`

Performs a `POST` request to the specified API endpoint with a request body.

    const response = await client.post('/api/v1/resource', { key: 'value' });

#### `put<T>(command: string, body: any): Promise<T>`

Performs a `PUT` request to the specified API endpoint with a request body.

    await client.put('/api/v1/resource/1', { key: 'updatedValue' });

#### `delete<T>(command: string, body?: any): Promise<T>`

Performs a `DELETE` request to the specified API endpoint. Optionally, you can include a request body.

    await client.delete('/api/v1/resource/1');

## Authentication Management

The `DocClient` class handles token-based authentication:
- Automatically attaches the `Authorization` header with the Bearer token for authenticated requests.
- Refreshes the access token when it expires using the stored refresh token.

## Example

    import DocClient from 'doc-api-client';

    const API_BASE_URL = 'https://api.example.com';

    (async () => {
        const client = new DocClient(API_BASE_URL);

        try {
            // Login
            await client.login('user', 'password', 'example.com', 'unique-fingerprint');

            // Fetch data
            const categories = await client.get('/api/v1/categories');
            console.log('Categories:', categories);

            // Create a new resource
            const newResource = await client.post('/api/v1/resource', { name: 'Sample' });
            console.log('Created resource:', newResource);
        } catch (error) {
            console.error('Error:', error.message);
        }
    })();

## License

Private, not for redistribution.

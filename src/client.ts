interface _response<T = any> {
	success: boolean;
	code: number;
	message: string;
	data: T | null;
	errors: Record<string, string>;
}

export class apiResponse<T = any> implements _response<T> {
	success: boolean = false;
	code: number = 500;
	message: string = '[No Message]';
	data: T | null = null;
	errors: Record<string, string> = {};

	static parseMessage(e: any, def: string = ''): string {
		if (typeof e === 'string') {
			return e;
		}
		if (e instanceof Error) {
			return e.message || '[No error message]';
		}
		if (e && typeof e.message === 'string') {
			return e.message;
		}
		return def || '[Unknown error type - neither string nor has .message]';
	}

	constructor(response: Partial<_response<T>> = {}) {
		this.success = response.success ?? false;
		this.code = response.code ?? 500;
		this.message = apiResponse.parseMessage(response.message);
		this.data = response.data ?? null;
		this.errors = response.errors ?? {};
	}

	static ok<T>(data: T, overrides: Partial<_response<T>> = {}): apiResponse<T> {
		return new apiResponse<T>({
			success: true,
			code: 200,
			message: 'OK',
			data,
			...overrides,
		});
	}

	static error<T>(message: string, overrides: Partial<_response<T>> = {}): apiResponse<T> {
		return new apiResponse<T>({
			success: false,
			code: 500,
			message,
			data: null,
			...overrides,
		});
	}

	addError(name: string, value: string) {
		this.errors[name] = value;
	}

	isSuccess(): this is apiResponse<T> & { data: T } {
		return this.success && this.data !== null;
	}
}

class apiClient {
	private apiKey: string | null = null;
	private aToken: string | null = null;
	private rToken: string | null = null;
	private apiUrl: string;
	debug: boolean = false;
	tokens: boolean = true;

	constructor(apiUrl: string, apiKey: string | null = null) {
		this.apiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
		this.apiKey = apiKey;
	}

	public set_debug(debug: boolean) {
		this.debug = debug;
	}

	public disable_tokens(token: boolean) {
		this.tokens = !token;
	}

	// Overridable class methods for token storage
	get_access_token(): string | null {
		return this.aToken;
	}

	set_access_token(access: string | null) {
		this.aToken = access;
	}

	get_refresh_token(): string | null {
		return this.rToken;
	}

	set_refresh_token(refresh: string | null) {
		this.rToken = refresh;
	}

	set_apikey(apikey: string | null) {
		this.apiKey = apikey;
	}

	get_apikey(): string | null {
		return this.apiKey;
	}

	// Not overridable

	async login<T>(
		username: string,
		password: string,
		domain: string = '',
		fingerprint: string = ''
	): Promise<apiResponse<T>> {
		try {
			const response = await fetch(`${this.apiUrl}/api/v1/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ login: username, password, domain, fingerprint }),
				credentials: 'include',
			});
			const data = await response.json();
			if (this.debug) {
				console.log('Login Response Headers:');
				response.headers.forEach((value, name) => {
					console.log(`${name}: ${value}`);
				});
			}
			if (!response.ok) {
				return apiResponse.error('Login Failed', {
					code: response.status,
					...data,
				});
			}
			this.set_access_token(data.data.accessToken);
			this.set_refresh_token(data.data.refreshToken);
			return apiResponse.ok(data.data, data);
		} catch (e: any) {
			return apiResponse.error(apiResponse.parseMessage(e, '[Unknown login response error]'));
		}
	}

	async logout<T>(token: string = ''): Promise<apiResponse<T>> {
		try {
			const response = await fetch(`${this.apiUrl}/api/v1/logout`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: token ? JSON.stringify({ token }) : '{}',
				credentials: 'include',
			});
			const data = await response.json();
			if (this.debug) {
				console.log('Logout Response Headers:');
				response.headers.forEach((value, name) => {
					console.log(`${name}: ${value}`);
				});
			}
			if (!response.ok) {
				return apiResponse.error(data.message || 'Logout Failed', { code: response.status });
			}
			this.set_access_token(null);
			this.set_refresh_token(null);
			return apiResponse.ok(data.data, data.message || 'Logout Successfull');
		} catch (e: any) {
			return apiResponse.error(apiResponse.parseMessage(e, '[Internal Server Error]'));
		}
	}

	private async refreshAccessToken<T>(): Promise<apiResponse<T>> {
		try {
			if (!this.get_refresh_token()) {
				return apiResponse.error('No Refresh Token Available', { code: 401 });
			}
			const response = await fetch(`${this.apiUrl}/api/v1/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refreshToken: this.get_refresh_token() }),
				credentials: 'include',
			});
			const data = await response.json();

			if (!response.ok) {
				return apiResponse.error(data.message || 'Token Refresh Failed', {
					code: response.status,
				});
			}
			this.set_access_token(data.data.accessToken);
			this.set_access_token(data.data.refreshToken);
			return apiResponse.ok(data.data, {
				message: data.message || 'Token Refreshed',
				code: response.status,
			});
		} catch (e: any) {
			return apiResponse.error(apiResponse.parseMessage(e, '[Unknown Server Error]'));
		}
	}

	private async fetchWithRetry<T>(url: string, options: RequestInit, retry: boolean = true): Promise<apiResponse<T>> {
		let response: Response;
		try {
			response = await fetch(url, options);
		} catch (error: any) {
			return apiResponse.error(error?.message || '[Unknown Server Error]');
		}

		let data: any;
		try {
			data = await response.json();
		} catch (error: any) {
			return apiResponse.error(error?.message || '[Error parsing JSON]', { code: response.status });
		}

		if (response.ok) {
			return apiResponse.ok<T>(data, {
				message: 'OK',
				code: response.status,
			});
		}

		if (this.apiKey) {
			return apiResponse.error(data.error || data.message || 'Not retrying request with APIKEY set', {
				code: response.status,
			});
		}

		if (response.status === 401 && retry && this.get_refresh_token()) {
			const res = await this.refreshAccessToken();
			if (!res.success) {
				return apiResponse.error(res.message, { code: res.code });
			}

			if (this.tokens) {
				options.headers = {
					...(options.headers || {}),
					Authorization: `Bearer ${this.get_access_token()}`,
				};
			}

			let retry: Response;
			try {
				retry = await fetch(url, options);
			} catch (error: any) {
				return apiResponse.error(error?.message || '[Unknown server error]');
			}
			let rdata;
			try {
				rdata = await retry.json();
			} catch (error: any) {
				return apiResponse.error(error?.message || '[Retried Request Failes]', {
					code: retry.status,
				});
			}
			if (retry.ok) {
				return apiResponse.ok<T>(rdata, {
					message: 'OK',
					code: response.status,
				});
			} else {
				return apiResponse.error(rdata.error || rdata.message || '[Unknown Request Fail]', {
					code: response.status,
				});
			}
		}
		return apiResponse.error('[Unable to serve request]', {
			code: response.status,
		});
	}

	async request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', command: string, body?: any): Promise<apiResponse<T>> {
		const url = `${this.apiUrl}${command}`;
		const token = this.apiKey || this.get_access_token() || null;
		const options: RequestInit = {
			method,
			headers: {
				'Content-Type': 'application/json',
			},
			credentials: 'include',
			body: body ? JSON.stringify(body) : null,
		};
		if (this.apiKey) {
			options.headers = {
				...(options.headers || {}),
				Authorization: `Bearer ${this.apiKey}`,
			};
		} else if (this.tokens) {
			options.headers = {
				...(options.headers || {}),
				Authorization: `Bearer ${this.get_access_token()}`,
			};
		}
		if (this.debug) {
			console.log(`Doing request: ${url} - ${JSON.stringify(options, undefined, 2)}`);
		}
		return this.fetchWithRetry<T>(url, options);
	}

	async get<T>(command: string): Promise<apiResponse<T>> {
		return this.request<T>('GET', command);
	}

	async post<T>(command: string, body: any): Promise<apiResponse<T>> {
		return this.request<T>('POST', command, body);
	}

	async put<T>(command: string, body: any): Promise<apiResponse<T>> {
		return this.request<T>('PUT', command, body);
	}

	async delete<T>(command: string, body?: any): Promise<apiResponse<T>> {
		return this.request<T>('DELETE', command, body);
	}
}

export default apiClient;

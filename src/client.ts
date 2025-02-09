interface _response<T = any> {
    success: boolean;
    code: number;
    message: string;
    data: T | null;
};

export class DocApiResponse<T = any> implements _response<T> {
    success: boolean = false;
    code: number = 500;
    message: string = "[No Message]";
    data: T | null = null;
    errors: Record<string,string> = {};

    constructor(success: boolean, code: number, message: any, data: T | null) {
        this.success = success;
        this.code = code;
        if (typeof message === "string") {
            this.message = message;
        } else if (message instanceof Error) {
            this.message = message.message ? `${message.message}` : "[No error message]";
        } else {
            this.message = "[Unknown error type]";
        }
        this.data = data;
    }
    
    addError(name: string, value: string) {
        this.errors[name] = value;
    }

    static ok<T>(data: T, message: any = "Success", code: number = 200): DocApiResponse<T> {
        if (!data) {
            data = {} as any;
        }
        return new DocApiResponse<T>(true, code, message, data);
    }

    static error<T>(message: any, code: number = 500): DocApiResponse<T> {
        return new DocApiResponse<T>(false, code, message, null);
    }

    isSuccess(): this is DocApiResponse<T> & { data: T } {
        return this.success && this.data !== null;
    }
}

class DocClient {
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

    async login<T>(username: string, password: string, domain: string = "", fingerprint: string = ""): Promise<DocApiResponse<T>> {
        try {
            const response = await fetch(`${this.apiUrl}/api/v1/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ login: username, password, domain, fingerprint }),
                credentials: 'include',
            });
            const data = await response.json();
            if (this.debug) {
                console.log('Response Headers:');
                response.headers.forEach((value, name) => {
                    console.log(`${name}: ${value}`);
                });
            }
            if (!response.ok) {
                return DocApiResponse.error(data.message || "Login Failed", response.status);
            }
            this.set_access_token(data.data.accessToken);
            this.set_refresh_token(data.data.refreshToken);
            return DocApiResponse.ok(data.data, data.message || 'Login Successfull', response.status);
        } catch (error: any) {
            return DocApiResponse.error(error.message || "[Internal Server Error]", 500);
        }
    }

    private async refreshAccessToken<T>(): Promise<DocApiResponse<T>> {
        try {
            if (!this.get_refresh_token()) {
                return DocApiResponse.error("No Refresh Token Available", 401);
            }
            const response = await fetch(`${this.apiUrl}/api/v1/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: this.get_refresh_token() }),
                credentials: 'include',
            });
            const data = await response.json();

            if (!response.ok) {
                return DocApiResponse.error(data.message || "Token Refresh Failed", response.status);
            }
            this.set_access_token(data.data.accessToken);
            this.set_access_token(data.data.refreshToken);
            return DocApiResponse.ok(data.data, data.message || 'Token Refreshed', response.status);
        } catch (error: any) {
            return DocApiResponse.error(error.message || '[Unknown Server Error]', 500);
        }
    }

    private async fetchWithRetry<T>(url: string, options: RequestInit, retry: boolean = true): Promise<DocApiResponse<T>> {
        try {
            const response = await fetch(url, options);
            const data = await response.json();
            if (response.ok) {
                return DocApiResponse.ok(data.data, data.message || 'Success', response.status);
            }
            if (this.apiKey) {
                return DocApiResponse.error(data.message || "Not retrying request with APIKEY set", response.status);
            }
            if (response.status === 401 && retry && this.get_refresh_token()) {
                const res = await this.refreshAccessToken();
                if (!res.success) {
                    return DocApiResponse.error(res.message, res.code);
                }

                if (this.tokens) {
                    options.headers = {
                        ...(options.headers || {}),
                        Authorization: `Bearer ${this.get_access_token()}`,
                    };
                }

                const retryResponse = await fetch(url, options);
                const retryData = await retryResponse.json();

                if (retryResponse.ok) {
                    return DocApiResponse.ok<T>(retryData.data, retryData.message || 'Success', retryResponse.status);
                }
                return DocApiResponse.error(retryData.message || '[Retried Request Failes]', retryResponse.status);
            }
            return DocApiResponse.error(data.message || '[Unknown Request Fail]', response.status);
        } catch (error: any) {
            return DocApiResponse.error(error.message || '[Unknown Server Error]', 500);
        }
    }

    async request<T>(method: "GET" | "POST" | "PUT" | "DELETE", command: string, body?: any): Promise<DocApiResponse<T>> {
        const url = `${this.apiUrl}${command}`;
        const token = this.apiKey || this.get_access_token() || null;
        const options: RequestInit = { 
            method,
            headers: {
                "Content-Type": "application/json"
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
        return this.fetchWithRetry<T>(url, options);
    }

    async get<T>(command: string): Promise<DocApiResponse<T>> {
        return this.request<T>("GET", command);
    }

    async post<T>(command: string, body: any): Promise<DocApiResponse<T>> {
        return this.request<T>("POST", command, body);
    }

    async put<T>(command: string, body: any): Promise<DocApiResponse<T>> {
        return this.request<T>("PUT", command, body);
    }

    async delete<T>(command: string, body?: any): Promise<DocApiResponse<T>> {
        return this.request<T>("DELETE", command, body);
    }
}

export default DocClient;

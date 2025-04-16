interface _response<T = any> {
    success: boolean;
    code: number;
    message: string;
    data: T | null;
    errors: Record<string, string>;
}
export declare class apiResponse<T = any> implements _response<T> {
    success: boolean;
    code: number;
    message: string;
    data: T | null;
    errors: Record<string, string>;
    static parseMessage(e: any, def?: string): string;
    constructor(response?: Partial<_response<T>>);
    static ok<T>(data: T, overrides?: Partial<_response<T>>): apiResponse<T>;
    static error<T>(message: string, overrides?: Partial<_response<T>>): apiResponse<T>;
    addError(name: string, value: string): void;
    isSuccess(): this is apiResponse<T> & {
        data: T;
    };
}
declare class apiClient {
    private apiKey;
    private aToken;
    private rToken;
    private apiUrl;
    debug: boolean;
    tokens: boolean;
    constructor(apiUrl: string, apiKey?: string | null);
    set_debug(debug: boolean): void;
    disable_tokens(token: boolean): void;
    get_access_token(): string | null;
    set_access_token(access: string | null): void;
    get_refresh_token(): string | null;
    set_refresh_token(refresh: string | null): void;
    set_apikey(apikey: string | null): void;
    get_apikey(): string | null;
    login<T>(username: string, password: string, domain?: string, fingerprint?: string): Promise<apiResponse<T>>;
    logout<T>(token?: string): Promise<apiResponse<T>>;
    private refreshAccessToken;
    private fetchWithRetry;
    request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', command: string, body?: any): Promise<apiResponse<T>>;
    get<T>(command: string): Promise<apiResponse<T>>;
    post<T>(command: string, body: any): Promise<apiResponse<T>>;
    put<T>(command: string, body: any): Promise<apiResponse<T>>;
    delete<T>(command: string, body?: any): Promise<apiResponse<T>>;
}
export default apiClient;

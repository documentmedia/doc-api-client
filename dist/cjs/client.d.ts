interface _response<T = any> {
    success: boolean;
    code: number;
    error: string;
    data: T | null;
    errors: Record<string, string>;
}
export declare class DocApiResponse<T = any> implements _response<T> {
    success: boolean;
    code: number;
    error: string;
    data: T | null;
    errors: Record<string, string>;
    private parseMessage;
    constructor(response?: Partial<_response<T>>);
    static ok<T>(data: T, overrides?: Partial<_response<T>>): DocApiResponse<T>;
    static error<T>(error: string, overrides?: Partial<_response<T>>): DocApiResponse<T>;
    addError(name: string, value: string): void;
    isSuccess(): this is DocApiResponse<T> & {
        data: T;
    };
}
declare class DocClient {
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
    login<T>(username: string, password: string, domain?: string, fingerprint?: string): Promise<DocApiResponse<T>>;
    logout<T>(token?: string): Promise<DocApiResponse<T>>;
    private refreshAccessToken;
    private fetchWithRetry;
    request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', command: string, body?: any): Promise<DocApiResponse<T>>;
    get<T>(command: string): Promise<DocApiResponse<T>>;
    post<T>(command: string, body: any): Promise<DocApiResponse<T>>;
    put<T>(command: string, body: any): Promise<DocApiResponse<T>>;
    delete<T>(command: string, body?: any): Promise<DocApiResponse<T>>;
}
export default DocClient;

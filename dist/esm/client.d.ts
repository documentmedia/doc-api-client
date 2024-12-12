interface _response<T = any> {
    success: boolean;
    code: number;
    message: string;
    data: T | null;
}
export declare class DocApiResponse<T = any> implements _response<T> {
    success: boolean;
    code: number;
    message: string;
    data: T | null;
    constructor(success: boolean, code: number, message: any, data: T | null);
    static ok<T>(data: T, message?: any, code?: number): DocApiResponse<T>;
    static error<T>(message: any, code?: number): DocApiResponse<T>;
    isSuccess(): this is DocApiResponse<T> & {
        data: T;
    };
}
declare class DocClient {
    private apiKey;
    private aToken;
    private rToken;
    private apiUrl;
    constructor(apiUrl: string, apiKey?: string | null);
    get_access_token(): string | null;
    set_access_token(access: string | null): void;
    get_refresh_token(): string | null;
    set_refresh_token(refresh: string | null): void;
    set_apikey(apikey: string | null): void;
    login<T>(username: string, password: string, domain?: string, fingerprint?: string): Promise<DocApiResponse<T>>;
    private refreshAccessToken;
    private fetchWithRetry;
    request<T>(method: "GET" | "POST" | "PUT" | "DELETE", command: string, body?: any): Promise<DocApiResponse<T>>;
    get<T>(command: string): Promise<DocApiResponse<T>>;
    post<T>(command: string, body: any): Promise<DocApiResponse<T>>;
    put<T>(command: string, body: any): Promise<DocApiResponse<T>>;
    delete<T>(command: string, body?: any): Promise<DocApiResponse<T>>;
}
export default DocClient;

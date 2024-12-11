declare class DocClient {
    private accessToken;
    private refreshToken;
    private apiUrl;
    constructor(apiUrl: string);
    set_access_token(token: string): void;
    login(username: string, password: string, domain: string, fingerprint: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    private refreshAccessToken;
    private fetchWithRetry;
    request<T>(method: "GET" | "POST" | "PUT" | "DELETE", command: string, body?: any): Promise<T>;
    get<T>(command: string): Promise<T>;
    post<T>(command: string, body: any): Promise<T>;
    put<T>(command: string, body: any): Promise<T>;
    delete<T>(command: string, body?: any): Promise<T>;
}
export default DocClient;

class DocClient {
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private apiUrl: string;

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl;
    }

    async login(username: string, password: string, domain: string, fingerprint: string): Promise<{ accessToken: string; refreshToken: string }> {
        try {
            const response = await fetch(`${this.apiUrl}/api/v1/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ login: username, password, domain, fingerprint }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP ${response.status}: ${errorData.message}`);
            }

            const data = await response.json();
            this.accessToken = data.data.accessToken;
            this.refreshToken = data.data.refreshToken;
            console.log("Login successful.");
            return data.data;
        } catch (error: any) {
            console.error("Login error:", error.message);
            throw error;
        }
    }

    private async refreshAccessToken(): Promise<boolean> {
        try {
            if (!this.refreshToken) throw new Error("No refresh token available.");

            const response = await fetch(`${this.apiUrl}/api/v1/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: this.refreshToken }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP ${response.status}: ${errorData.message}`);
            }

            const data = await response.json();
            this.accessToken = data.data.accessToken;
            this.refreshToken = data.data.refreshToken;

            console.log("Access token refreshed.");
            return true;
        } catch (error: any) {
            console.error("Token refresh error:", error.message);
            throw error;
        }
    }

    private async fetchWithRetry<T>(url: string, options: RequestInit, retry: boolean = true): Promise<T> {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return await response.json();
            } else if (response.status === 401 && retry && this.refreshToken) {
                // console.warn("Access token expired, attempting to refresh...");
                await this.refreshAccessToken();

                options.headers = {
                    ...(options.headers || {}),
                    Authorization: `Bearer ${this.accessToken}`,
                };
                const retryResponse = await fetch(url, options);

                if (retryResponse.ok) {
                    return await retryResponse.json();
                }

                const retryErrorData = await retryResponse.json();
                throw new Error(`HTTP ${retryResponse.status}: ${retryErrorData.message}`);
            }
            const errorData = await response.json();
            // console.log(JSON.stringify(errorData, undefined, 2))
            throw new Error(`HTTP ${response.status}: ${errorData.message}`);
        } catch (error: any) {
            console.error("Request failed:", error.message);
            throw error;
        }
    }

    async request<T>(method: "GET" | "POST" | "PUT" | "DELETE", command: string, body?: any): Promise<T> {
        const url = `${this.apiUrl}${command}`;
        const options: RequestInit = {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        };
        // console.log(JSON.stringify(options, undefined, 2))
        return this.fetchWithRetry<T>(url, options);
    }

    // Shortcut methods for common HTTP methods
    async get<T>(command: string): Promise<T> {
        return this.request<T>("GET", command);
    }

    async post<T>(command: string, body: any): Promise<T> {
        return this.request<T>("POST", command, body);
    }

    async put<T>(command: string, body: any): Promise<T> {
        return this.request<T>("PUT", command, body);
    }

    async delete<T>(command: string, body?: any): Promise<T> {
        return this.request<T>("DELETE", command, body);
    }
}

export default DocClient;

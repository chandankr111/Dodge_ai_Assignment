export interface ChatResponse {
    answer: string;
    sql?: string;
    data?: any[];
    isRelevant: boolean;
}
export declare function handleChatQuery(question: string): Promise<ChatResponse>;
//# sourceMappingURL=llmService.d.ts.map
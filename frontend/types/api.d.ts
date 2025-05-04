declare module '@/lib/api' {
  export function getOrderReviewStatus(orderId: number): Promise<any>;
  export function createOrderReview(data: any): Promise<any>;
  export function createServiceReview(data: any): Promise<any>;
  export function createCombinedReview(data: any): Promise<any>;
}

declare module '@/context/AuthContext' {
  export function useAuth(): any;
} 
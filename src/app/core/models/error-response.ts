export interface ErrorResponse {
  status: number;
  message: string;
  errors?: { [key: string]: string[] };
  timestamp: string;
  path: string;
} 
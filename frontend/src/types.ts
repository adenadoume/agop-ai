export interface Conversation {
  id: string
  title: string
  model: string
  created_at: string
  updated_at: string
  total_cost: number
  total_input_tokens: number
  total_output_tokens: number
  message_count: number
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  model?: string
  input_tokens?: number
  output_tokens?: number
  cost?: number
  created_at: string
}

export type ModelId =
  | 'claude-haiku-4-5-20251001'
  | 'claude-sonnet-4-6'
  | 'claude-opus-4-6'

export interface ModelInfo {
  id: ModelId
  label: string
  inputPricePerM: number
  outputPricePerM: number
}

export const MODELS: ModelInfo[] = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku',  inputPricePerM: 0.25,  outputPricePerM: 1.25 },
  { id: 'claude-sonnet-4-6',          label: 'Sonnet', inputPricePerM: 3.00,  outputPricePerM: 15.0 },
  { id: 'claude-opus-4-6',            label: 'Opus',   inputPricePerM: 15.00, outputPricePerM: 75.0 },
]

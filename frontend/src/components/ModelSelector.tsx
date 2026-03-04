import { Select } from 'antd'
import { ModelId, MODELS } from '../types'

interface Props {
  value: ModelId
  onChange: (model: ModelId) => void
  disabled?: boolean
}

export default function ModelSelector({ value, onChange, disabled }: Props) {
  return (
    <Select
      className="model-select"
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{ width: 120 }}
      popupClassName="dark-popup"
      options={MODELS.map(m => ({ value: m.id, label: m.label }))}
    />
  )
}

import { useUIState } from '../../store/appContext'
import './Modals.css'
import { AddModal } from './AddModal'
import { RenameModal } from './RenameModal'
import { DeleteModal } from './DeleteModal'
import { ValueInspectorModal } from './ValueInspectorModal'

export function Modals() {
  const { modal } = useUIState()

  return (
    <>
      <AddModal open={modal.kind === 'add'} />
      <RenameModal open={modal.kind === 'rename'} />
      <DeleteModal open={modal.kind === 'delete'} />
      <ValueInspectorModal open={modal.kind === 'value-inspector'} />
    </>
  )
}

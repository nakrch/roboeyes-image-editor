import { createContext, useContext, type ReactNode } from 'react'
import './historyControls.css'

type ContinuousEditController = {
  begin: () => void
  end: () => void
}

const ContinuousEditContext = createContext<ContinuousEditController>({
  begin: () => undefined,
  end: () => undefined,
})

export function ContinuousEditProvider({
  value,
  children,
}: {
  value: ContinuousEditController
  children: ReactNode
}) {
  return (
    <ContinuousEditContext.Provider value={value}>
      {children}
    </ContinuousEditContext.Provider>
  )
}

export function useContinuousEdit(): ContinuousEditController {
  return useContext(ContinuousEditContext)
}

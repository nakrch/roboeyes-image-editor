export function ParameterPanel() {
  return (
    <aside className="panel parameter-panel" aria-label="Parameter controls">
      <div className="panel-heading">
        <p className="eyebrow">Parameters</p>
        <h2>Controls</h2>
      </div>

      <div className="placeholder-block">
        <strong>Generic model controls</strong>
        <p>
          Geometry, gaze, color, and preset controls will be connected through the
          model and adapter layers in later issues.
        </p>
      </div>
    </aside>
  )
}

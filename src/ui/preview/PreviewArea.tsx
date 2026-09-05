export function PreviewArea() {
  return (
    <section className="panel preview-panel" aria-label="Preview">
      <div className="panel-heading">
        <p className="eyebrow">Preview</p>
        <h2>Canvas</h2>
      </div>

      <div className="preview-stage">
        <div className="preview-placeholder" role="img" aria-label="Preview placeholder">
          <span>SVG renderer connects here in Issue #3</span>
        </div>
      </div>
    </section>
  )
}

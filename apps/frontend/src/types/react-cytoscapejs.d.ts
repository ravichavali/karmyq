declare module 'react-cytoscapejs' {
  import type { Component } from 'react'
  import type cytoscape from 'cytoscape'

  interface CytoscapeComponentProps {
    elements: cytoscape.ElementDefinition[]
    stylesheet?: cytoscape.StylesheetCSS[] | unknown[]
    layout?: cytoscape.LayoutOptions | Record<string, unknown>
    style?: React.CSSProperties
    className?: string
    cy?: (cy: cytoscape.Core) => void
    minZoom?: number
    maxZoom?: number
    zoom?: number
    pan?: cytoscape.Position
    wheelSensitivity?: number
  }

  export default class CytoscapeComponent extends Component<CytoscapeComponentProps> {}
}

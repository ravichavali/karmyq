import React from 'react'

export let lastForceGraphProps: any = null

export const forceGraphMethods = {
  zoom: jest.fn(),
  centerAt: jest.fn(),
  zoomToFit: jest.fn(),
  d3Force: jest.fn(),
  d3ReheatSimulation: jest.fn(),
}

export const resetForceGraphMock = () => {
  lastForceGraphProps = null
  jest.clearAllMocks()
}

export default function ForceGraph2DMock(props: any) {
  lastForceGraphProps = props
  if (props.ref) props.ref.current = forceGraphMethods
  return <canvas data-testid="force-graph" />
}

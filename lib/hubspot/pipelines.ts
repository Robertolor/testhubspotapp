const HS_BASE = "https://api.hubapi.com";

export interface HubspotDealStage {
  id: string;
  label: string;
  displayOrder: number;
}

export interface HubspotDealPipeline {
  id: string;
  label: string;
  displayOrder: number;
  stages: HubspotDealStage[];
}

interface HubspotPipelineResponse {
  results?: {
    id: string;
    label: string;
    displayOrder: number;
    stages?: {
      id: string;
      label: string;
      displayOrder: number;
    }[];
  }[];
}

/** List deal pipelines and stages from HubSpot CRM. */
export async function listDealPipelines(
  accessToken: string
): Promise<HubspotDealPipeline[]> {
  const res = await fetch(`${HS_BASE}/crm/v3/pipelines/deals`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`HubSpot pipelines list failed: ${await res.text()}`);
  }

  const data = (await res.json()) as HubspotPipelineResponse;
  return (data.results ?? []).map((pipeline) => ({
    id: pipeline.id,
    label: pipeline.label,
    displayOrder: pipeline.displayOrder,
    stages: [...(pipeline.stages ?? [])]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((stage) => ({
        id: stage.id,
        label: stage.label,
        displayOrder: stage.displayOrder,
      })),
  }));
}

export async function getDealPipelineById(
  accessToken: string,
  pipelineId: string
): Promise<HubspotDealPipeline | null> {
  const pipelines = await listDealPipelines(accessToken);
  return pipelines.find((pipeline) => pipeline.id === pipelineId) ?? null;
}

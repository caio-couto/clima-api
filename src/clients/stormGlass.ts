import { InternalError } from "@src/util/errors/internal-error";
import * as HTTPUtil from "@src/util/request";
import config, { IConfig } from "config";

export interface StormGlassPointSorce 
{
  [key: string]: number;
}

export interface StormGlassPoint 
{
  readonly time: string;
  readonly waveHeight: StormGlassPointSorce;
  readonly waveDirection: StormGlassPointSorce;
  readonly swellDirection: StormGlassPointSorce;
  readonly swellHeight: StormGlassPointSorce;
  readonly swellPeriod: StormGlassPointSorce;
  readonly windDirection: StormGlassPointSorce;
  readonly windSpeed: StormGlassPointSorce;
}

export interface StormGlassForecastResponse
{
  hours: StormGlassPoint[];
}

export interface ForecastPoint
{
  time: string;
  waveHeight: number;
  waveDirection: number;
  swellDirection: number;
  swellHeight: number;
  swellPeriod: number;
  windDirection: number;
  windSpeed: number;
}

export class StormGlassUnexpectedResponseError extends InternalError
{
  constructor(message: string)
  {
    super(message);
  }
}

export class ClientRequestError extends InternalError 
{
  constructor(message: string)
  {
    const internalMessage: string = "Unexpected error when trying to communicate to StormGlass";
    super(`${internalMessage}: ${message}`);
  }
}

export class StormGlassResponseError extends InternalError
{
  constructor(message: string)
  {
    const internalMessage: string = "Unexpected error returned by the StormGlass service";
    super(`${internalMessage}: ${message}`);
  }
}

const stormGlassResourceConfig: IConfig = config.get("App.resources.StormGlass");

export class StormGlass 
{
  readonly stormGlassAPIParams: string = "swellDirection,swellHeight,swellPeriod,waveDirection,waveHeight,windDirection,windSpeed";
  readonly stormGlassAPISource: string = "noaa";

  constructor(protected request: HTTPUtil.Request = new HTTPUtil.Request()) {}

  public async fetchPoints(lat: number, lng: number): Promise<ForecastPoint[]>
  {
    try 
    {
      const response: HTTPUtil.Response<StormGlassForecastResponse> = await this.request.get<StormGlassForecastResponse>(`${stormGlassResourceConfig.get("apiUrl")}/weather/point?lat=${lat}&lng=${lng}&params=${this.stormGlassAPIParams}&source=${this.stormGlassAPISource}`,
      {
        headers:
        {
          Authorization: stormGlassResourceConfig.get("apiToken"),
        },
      });

      return this.normalizeResponse(response.data);
    } catch (err: unknown)
    {
      if (err instanceof Error && HTTPUtil.Request.isRequestError(err))
      {
        const error = HTTPUtil.Request.extractErrorData(err);
        throw new StormGlassResponseError(`Error: ${JSON.stringify(error.data)} Code: ${error.status}`); 
      }
      throw new ClientRequestError(JSON.stringify(err));
    }
  }

  private normalizeResponse(points: StormGlassForecastResponse): ForecastPoint[]
  { 
    return points.hours.filter(this.isValidPoint.bind(this)).map((point) => (
    {
      time: point.time,
      waveHeight: point.waveHeight[this.stormGlassAPISource],
      waveDirection: point.waveDirection[this.stormGlassAPISource],
      swellDirection: point.swellDirection[this.stormGlassAPISource],
      swellHeight: point.swellHeight[this.stormGlassAPISource],
      swellPeriod: point.swellPeriod[this.stormGlassAPISource],
      windDirection: point.windDirection[this.stormGlassAPISource],
      windSpeed: point.windSpeed[this.stormGlassAPISource],
    }));
  }

  private isValidPoint(point: Partial<StormGlassPoint>): boolean
  {
    return !!(
      point.time &&
      point.swellDirection?.[this.stormGlassAPISource] &&
      point.swellHeight?.[this.stormGlassAPISource] &&
      point.swellPeriod?.[this.stormGlassAPISource] &&
      point.waveDirection?.[this.stormGlassAPISource] &&
      point.waveHeight?.[this.stormGlassAPISource] &&
      point.windDirection?.[this.stormGlassAPISource] &&
      point.windSpeed?.[this.stormGlassAPISource]
    );
  }
}

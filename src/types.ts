export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

export interface ScreenshotStep {
  click?: string;
  fill?: {
    selector: string;
    text: string;
  };
  wait?: number;
  waitFor?: string;
}

export interface ScreenshotConfig {
  name: string;
  url: string;
  viewport: Viewport;
  fullPage?: boolean;
  waitFor?: string;
  wait?: number;
  steps?: ScreenshotStep[];
}

export interface Config {
  version: number;
  screenshots: ScreenshotConfig[];
  output: {
    branch: string;
    comment: {
      template: string;
      group_by: string;
    };
  };
  skip?: {
    label?: string;
    wipTitles?: boolean;
  };
}

export interface FrameworkInfo {
  id: string;
  name: string;
  config: Config;
}

export interface CapturedScreenshot {
  name: string;
  browser: string;
  path: string;
}

export interface UploadedScreenshot {
  name: string;
  browser: string;
  url: string;
}

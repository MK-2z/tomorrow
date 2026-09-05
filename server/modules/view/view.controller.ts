import { Controller, Get, Render, Req } from '@nestjs/common';

@Controller()
export class ViewController {

  @Get(['/', '*'])
  @Render('index')
  async render(@Req() req: any): Promise<{ __platform__: string }>  {
    // you can add custom render params here
    const platformData = req.__platform_data__ ?? {};
    return {
      // don't delete this line, it's used by client to get platform info
      __platform__: JSON.stringify(platformData),
    };
  }
}

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true, credentials: true });

  // Serve static files from public directory
  app.useStaticAssets(join(__dirname, '..', 'public'));

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`✅ API ready at http://localhost:${port}`);
}
void bootstrap();

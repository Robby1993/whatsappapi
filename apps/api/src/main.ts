import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Safety Net to prevent library-internal errors from crashing the process
  process.on('uncaughtException', (err) => {
    console.error('🔥 Global Uncaught Exception:', err.message);
    if (err.stack) console.error(err.stack);
  });

  process.on('unhandledRejection', (reason: any) => {
    console.error('🌊 Global Unhandled Rejection:', reason?.message || reason);
  });

  app.setGlobalPrefix('api');
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 MsgPilot Server running on port ${port}`);
}
bootstrap();

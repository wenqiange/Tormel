import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:5173');
  app.enableCors({
    origin: corsOrigins.split(','),
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Tormel POS API')
    .setDescription('API documentation for Tormel Point of Sale System')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('tables', 'Table management')
    .addTag('products', 'Product catalog')
    .addTag('orders', 'Order processing')
    .addTag('billing', 'Billing and invoices')
    .addTag('payments', 'Payment processing')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🍽️  TORMEL POS SYSTEM                                    ║
║                                                            ║
║   Server running on: http://localhost:${port}               ║
║   API Documentation: http://localhost:${port}/api/docs      ║
║                                                            ║
║   Environment: ${configService.get('NODE_ENV', 'development')}                            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
}

bootstrap();

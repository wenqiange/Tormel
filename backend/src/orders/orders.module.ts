import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { PrintingModule } from '../printing/printing.module';

@Module({
  imports: [
    forwardRef(() => RealtimeModule),
    forwardRef(() => PrintingModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

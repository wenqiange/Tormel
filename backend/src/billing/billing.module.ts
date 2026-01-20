import { Module, forwardRef } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { PrintingModule } from '../printing/printing.module';

@Module({
  imports: [
    forwardRef(() => RealtimeModule),
    forwardRef(() => PrintingModule),
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}

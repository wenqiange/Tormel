import { Module, forwardRef } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { BillingModule } from '../billing/billing.module';
import { PrintingModule } from '../printing/printing.module';
import { TablesModule } from '../tables/tables.module';

@Module({
  imports: [
    forwardRef(() => RealtimeModule),
    forwardRef(() => BillingModule),
    forwardRef(() => PrintingModule),
    forwardRef(() => TablesModule),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

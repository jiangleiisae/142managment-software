import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthContext } from '../auth/jwt-payload.interface.js';
import { RetentionService } from './retention.service.js';

@Controller('retention-policies')
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Get()
  listPolicies() {
    return this.retentionService.listPolicies();
  }

  @Get('compliance-status')
  getComplianceStatus(@CurrentUser() user: AuthContext) {
    return this.retentionService.getComplianceStatus(user.tenantId);
  }
}

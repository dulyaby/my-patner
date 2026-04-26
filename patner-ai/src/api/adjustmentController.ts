import { AdjustmentService } from './adjustmentService';
import { Adjustment, UserProfile } from '../types';

export class AdjustmentController {
  /**
   * POST /adjustments
   * Create a new adjustment.
   * Only owner or manager can adjust sales.
   */
  static async createAdjustment(
    profile: UserProfile, 
    adjustmentData: Omit<Adjustment, 'id' | 'userId' | 'createdAt' | 'businessId'>
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    // 1. Authorization check
    if (profile.role !== 'owner' && profile.role !== 'manager') {
      return { success: false, error: 'Huna ruhusa ya kufanya marekebisho ya mauzo.' };
    }

    try {
      // Get the sale first to ensure we use the correct businessId
      const saleData = await AdjustmentService.getSaleWithAdjustments(adjustmentData.saleId);
      const businessId = saleData.sale.businessId;

      const id = await AdjustmentService.createAdjustment({
        ...adjustmentData,
        userId: profile.uid,
        businessId: businessId,
        createdAt: new Date().toISOString()
      });
      return { success: true, id };
    } catch (error: any) {
      console.error('Adjustment Error:', error);
      return { success: false, error: error.message || 'Imeshindikana kufanya marekebisho' };
    }
  }

  /**
   * GET /sales/:id
   * Get sale with adjustments.
   */
  static async getSaleWithAdjustments(saleId: string) {
    try {
      const data = await AdjustmentService.getSaleWithAdjustments(saleId);
      return { success: true, data };
    } catch (error: any) {
      console.error('Get Sale Error:', error);
      return { success: false, error: error.message || 'Failed to get sale' };
    }
  }

  /**
   * GET /adjustments
   * List all adjustments for the current business.
   */
  static async listAdjustments(businessId: string) {
    try {
      const data = await AdjustmentService.listAdjustments(businessId);
      return { success: true, data };
    } catch (error: any) {
      console.error('List Adjustments Error:', error);
      return { success: false, error: error.message || 'Failed to list adjustments' };
    }
  }
}

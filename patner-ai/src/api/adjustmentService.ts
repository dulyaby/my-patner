import { 
  collection, 
  addDoc, 
  getDoc, 
  getDocs, 
  doc, 
  query, 
  where, 
  orderBy,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { Sale, Adjustment, AdjustmentItem, Product } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export class AdjustmentService {
  private static adjustmentsCol = collection(db, 'adjustments');
  private static salesCol = collection(db, 'sales');
  private static productsCol = collection(db, 'products');

  /**
   * Create a new adjustment for a sale.
   */
  static async createAdjustment(adjustmentData: Omit<Adjustment, 'id'>): Promise<string> {
    try {
      return await runTransaction(db, async (transaction) => {
        // 1. Get the sale to verify it exists
        const saleRef = doc(this.salesCol, adjustmentData.saleId);
        const saleDoc = await transaction.get(saleRef);
        if (!saleDoc.exists()) {
          throw new Error('Sale not found');
        }
        const sale = saleDoc.data() as Sale;

        // 2. Validate quantities
        for (const adjItem of adjustmentData.items) {
          const originalItem = sale.items.find(i => i.productId === adjItem.productId);
          if (!originalItem) {
            throw new Error(`Product ${adjItem.name} was not part of the original sale`);
          }
          if (adjItem.quantity > originalItem.quantity) {
            throw new Error(`Cannot adjust more than original quantity for ${adjItem.name}`);
          }
        }

        // 3. Update inventory
        for (const adjItem of adjustmentData.items) {
          const productRef = doc(this.productsCol, adjItem.productId);
          const productDoc = await transaction.get(productRef);
          
          if (productDoc.exists()) {
            const product = productDoc.data() as Product;
            transaction.update(productRef, {
              stock: product.stock + adjItem.quantity,
              updatedAt: new Date().toISOString()
            });
          }
        }

        // 4. Record the adjustment
        const adjRef = doc(this.adjustmentsCol);
        transaction.set(adjRef, adjustmentData);

        return adjRef.id;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'adjustments/transaction');
      throw error; // unreachable but for TS
    }
  }

  /**
   * Get a sale with all its adjustments.
   */
  static async getSaleWithAdjustments(saleId: string): Promise<{ sale: Sale; adjustments: Adjustment[] }> {
    let sale: Sale;
    try {
      const saleDoc = await getDoc(doc(this.salesCol, saleId));
      if (!saleDoc.exists()) {
        throw new Error('Sale not found');
      }
      sale = { id: saleDoc.id, ...saleDoc.data() } as Sale;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `sales/${saleId}`);
      throw error;
    }

    try {
      const adjQuery = query(
        this.adjustmentsCol, 
        where('saleId', '==', saleId),
        where('businessId', '==', sale.businessId),
        orderBy('createdAt', 'desc')
      );
      const adjSnapshot = await getDocs(adjQuery);
      const adjustments = adjSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Adjustment));

      // Calculate adjusted total
      const totalAdjustment = adjustments.reduce((sum, adj) => sum + adj.amount, 0);
      sale.adjustedTotal = sale.total + totalAdjustment;

      return { sale, adjustments };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'adjustments');
      throw error;
    }
  }

  /**
   * List all adjustments for a business.
   */
  static async listAdjustments(businessId: string): Promise<Adjustment[]> {
    try {
      const q = query(
        this.adjustmentsCol, 
        where('businessId', '==', businessId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Adjustment));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'adjustments');
      throw error;
    }
  }
}

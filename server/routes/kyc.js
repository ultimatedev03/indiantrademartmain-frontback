import express from 'express';
import { supabase } from '../lib/supabaseClient.js';

const router = express.Router();

// GET /api/kyc/vendors - Fetch vendors grouped by KYC status
router.get('/vendors', async (req, res) => {
  try {
    const { status = 'PENDING' } = req.query;
    
    console.log(`🔍 Fetching vendors with KYC status: ${status}`);
    
    let query = supabase
      .from('vendors')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (status && status !== 'ALL') {
      query = query.eq('kyc_status', status);
    }
    
    const { data: vendors, error } = await query;
    
    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({
        error: 'Failed to fetch vendors',
        details: error.message
      });
    }
    
    console.log(`📋 Found ${vendors?.length || 0} vendors`);
    
    // Enrich vendors with their documents
    const vendorIds = vendors?.map(v => v.id) || [];
    let docsMap = {};
    
    if (vendorIds.length > 0) {
      const { data: docs, error: docsError } = await supabase
        .from('vendor_documents')
        .select('vendor_id, document_type, verification_status, document_url')
        .in('vendor_id', vendorIds);
      
      if (!docsError && docs) {
        docsMap = docs.reduce((acc, doc) => {
          if (!acc[doc.vendor_id]) acc[doc.vendor_id] = [];
          acc[doc.vendor_id].push(doc);
          return acc;
        }, {});
      }
    }
    
    const enrichedVendors = vendors.map(v => ({
      ...v,
      documents: docsMap[v.id] || []
    }));
    
    res.json({
      success: true,
      vendors: enrichedVendors
    });
    
  } catch (error) {
    console.error('❌ Error fetching vendors:', error);
    res.status(500).json({
      error: 'Failed to fetch vendors',
      details: error.message
    });
  }
});

// GET /api/kyc/vendors/:vendorId/documents - Fetch vendor documents
router.get('/vendors/:vendorId/documents', async (req, res) => {
  try {
    const { vendorId } = req.params;
    
    console.log(`🔍 Fetching documents for vendor: ${vendorId}`);
    
    const { data: documents, error } = await supabase
      .from('vendor_documents')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('uploaded_at', { ascending: false });
    
    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({
        error: 'Failed to fetch documents',
        details: error.message
      });
    }
    
    console.log(`📄 Found ${documents?.length || 0} documents`);
    
    res.json({
      success: true,
      documents: documents || []
    });
    
  } catch (error) {
    console.error('❌ Error fetching documents:', error);
    res.status(500).json({
      error: 'Failed to fetch documents',
      details: error.message
    });
  }
});

// POST /api/kyc/vendors/:vendorId/approve - Approve KYC
router.post('/vendors/:vendorId/approve', async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { employeeId } = req.body;
    
    console.log(`✅ Approving KYC for vendor: ${vendorId}`);
    
    // Update all vendor_documents to APPROVED for this vendor
    const { data: updateResult, error: updateError } = await supabase
      .from('vendor_documents')
      .update({
        verification_status: 'APPROVED'
      })
      .eq('vendor_id', vendorId)
      .select();
    
    if (updateError) {
      console.error('❌ Error updating documents:', updateError);
      return res.status(500).json({
        error: 'Failed to approve KYC documents',
        details: updateError.message
      });
    }
    
    // Update vendor kyc_status
    const { data: vendorResult, error: vendorError } = await supabase
      .from('vendors')
      .update({
        kyc_status: 'APPROVED',
        verification_badge: true
      })
      .eq('id', vendorId)
      .select()
      .single();
    
    if (vendorError) {
      console.error('❌ Error updating vendor:', vendorError);
      return res.status(500).json({
        error: 'Failed to update vendor KYC status',
        details: vendorError.message
      });
    }
    
    console.log(`✅ KYC approved for vendor ${vendorId}, updated ${updateResult?.length || 0} documents`);
    
    res.json({
      success: true,
      message: 'KYC approved successfully',
      vendor: vendorResult,
      documentsUpdated: updateResult?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Error approving KYC:', error);
    res.status(500).json({
      error: 'Failed to approve KYC',
      details: error.message
    });
  }
});

// POST /api/kyc/vendors/:vendorId/reject - Reject KYC
router.post('/vendors/:vendorId/reject', async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { remarks, employeeId } = req.body;
    
    if (!remarks || remarks.trim() === '') {
      return res.status(400).json({
        error: 'Remarks are required for rejection'
      });
    }
    
    console.log(`❌ Rejecting KYC for vendor: ${vendorId}`);
    
    // Update all vendor_documents to REJECTED for this vendor
    const { data: updateResult, error: updateError } = await supabase
      .from('vendor_documents')
      .update({
        verification_status: 'REJECTED'
      })
      .eq('vendor_id', vendorId)
      .select();
    
    if (updateError) {
      console.error('❌ Error updating documents:', updateError);
      return res.status(500).json({
        error: 'Failed to reject KYC documents',
        details: updateError.message
      });
    }
    
    // Store rejection remarks in kyc_remarks table
    const { error: remarksError } = await supabase
      .from('kyc_remarks')
      .insert([{
        vendor_id: vendorId,
        remarks: remarks.trim(),
        created_by: employeeId || null,
        created_at: new Date().toISOString()
      }]);
    
    if (remarksError) {
      console.error('❌ Error storing remarks:', remarksError);
      return res.status(500).json({
        error: 'Failed to store rejection remarks',
        details: remarksError.message
      });
    }
    
    // Update vendor kyc_status
    const { data: vendorResult, error: vendorError } = await supabase
      .from('vendors')
      .update({
        kyc_status: 'REJECTED',
        verification_badge: false
      })
      .eq('id', vendorId)
      .select()
      .single();
    
    if (vendorError) {
      console.error('❌ Error updating vendor:', vendorError);
      return res.status(500).json({
        error: 'Failed to update vendor KYC status',
        details: vendorError.message
      });
    }
    
    console.log(`✅ KYC rejected for vendor ${vendorId}, updated ${updateResult?.length || 0} documents`);
    
    res.json({
      success: true,
      message: 'KYC rejected successfully',
      vendor: vendorResult,
      documentsUpdated: updateResult?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Error rejecting KYC:', error);
    res.status(500).json({
      error: 'Failed to reject KYC',
      details: error.message
    });
  }
});

export default router;

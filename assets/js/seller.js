// ============================================================
// SELLER DASHBOARD UTILITIES
// ============================================================

// Form validation helper functions
function validateForm(formData) {
  const errors = [];
  
  // Personal Information fields
  if (!formData.full_name?.trim()) errors.push('Please enter your full name');
  if (!formData.id_number?.trim()) errors.push('Please enter your ID number');
  
  // ID number validation
  if (formData.id_number && !/^\d{13}$/.test(formData.id_number)) {
    errors.push('ID number must be exactly 13 digits');
  }
  
  // Date of birth validation
  if (formData.date_of_birth && new Date(formData.date_of_birth) > new Date()) {
    errors.push('Date of birth cannot be in the future');
  }
  
  return errors.length > 0 ? errors : null;
}

// Enhanced submit verification function with proper validation
async function submitVerification(event) {
  event.preventDefault();
  
  const btn = document.getElementById('submit-verify-btn');
  if (!btn) return;
  
  // Validate form data
  const formData = {
    full_name: document.getElementById('v-fullname').value,
    id_number: document.getElementById('v-idnumber').value,
    date_of_birth: document.getElementById('v-dob').value,
    phone: document.getElementById('v-phone').value,
    address: document.getElementById('v-address').value,
    city: document.getElementById('v-city').value,
    province: document.getElementById('v-province').value,
    postal_code: document.getElementById('v-postal').value,
    business_name: document.getElementById('v-bizname').value,
    registration_number: document.getElementById('v-regnumber').value,
    tax_number: document.getElementById('v-taxnumber').value,
    business_type: document.getElementById('v-biztype').value,
    industry: document.getElementById('v-industry').value,
    website: document.getElementById('v-website').value
  };
  
  const validationErrors = validateForm(formData);
  if (validationErrors) {
    UI.toast(validationErrors.join('<br>'), 'error');
    return;
  }
  
  try {
    // Show loading state
    UI.setLoading(btn, true, 'Submitting...');
    
    // Upload documents first
    const files = [
      { inputId: 'v-id-doc', type: 'id_document' },
      { inputId: 'v-poa-doc', type: 'proof_of_address' },
      { inputId: 'v-cipc-doc', type: 'cipc_certificate' },
      { inputId: 'v-tax-doc', type: 'tax_clearance' }
    ];
    
    const uploadPromises = files.map(file => {
      const input = document.getElementById(file.inputId);
      if (input?.files?.length) {
        return api.upload.file(input.files[0], file.type);
      }
      return Promise.resolve({ url: '' });
    });
    
    const [idDocUrl, poaDocUrl, cipcDocUrl, taxDocUrl] = await Promise.all(uploadPromises);
    
    const payload = {
      full_name: formData.full_name,
      id_number: formData.id_number,
      date_of_birth: formData.date_of_birth || null,
      phone: formData.phone || null,
      address: formData.address,
      city: formData.city,
      province: formData.province,
      postal_code: formData.postal_code,
      business_name: formData.business_name,
      registration_number: formData.registration_number,
      tax_number: formData.tax_number,
      business_type: formData.business_type,
      industry: formData.industry,
      website: formData.website,
      id_document_url: idDocUrl.url,
      proof_of_address_url: poaDocUrl.url,
      cipc_certificate_url: cipcDocUrl.url,
      tax_clearance_url: taxDocUrl.url
    };
    
    await api.verification.apply(payload);
    UI.toast('Application submitted! We\'ll review it within 1-3 business days.', 'success');
    loadVerificationStatus();
    
  } catch (err) {
    UI.toast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Submit Verification Application — R29/month';
    }
  }
}

// Enhanced loading verification status function
async function loadVerificationStatus() {
  const statusCard = document.getElementById('verify-status-card');
  const formCard = document.getElementById('verify-form-card');
  const navBadge = document.getElementById('verified-badge-nav');
  
  if (!statusCard || !formCard) return;
  
  try {
    const data = await api.verification.status();
    
    if (!data) {
      formCard.style.display = 'block';
      statusCard.style.display = 'none';
      if (navBadge) navBadge.style.display = 'none';
      return;
    }
    
    if (data.status === 'approved') {
      formCard.style.display = 'none';
      statusCard.style.display = 'block';
      statusCard.innerHTML = `
        <div class="card-body" style="text-align:center;padding:var(--space-xl);">
          <div style="width:64px;height:64px;border-radius:50%;background:rgba(39,174,96,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-md);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h3 style="color:#27ae60;margin-bottom:var(--space-sm);">✓ Verified Seller</h3>
          <p style="color:var(--text-secondary);font-size:14px;">Your verification badge is active. Your stores display a verified badge to customers.</p>
          <p style="color:var(--text-muted);font-size:12px;">Verified since ${UI.formatDate(data.reviewed_at || data.created_at)}</p>
        </div>`;
      if (navBadge) navBadge.style.display = 'inline';
      const roleEl = document.getElementById('verified-badge-role');
      if (roleEl) roleEl.style.display = 'inline';
      return;
    }
    
    if (data.status === 'pending') {
      formCard.style.display = 'none';
      statusCard.style.display = 'block';
      statusCard.innerHTML = `
        <div class="card-body" style="text-align:center;padding:var(--space-xl);">
          <div style="width:64px;height:64px;border-radius:50%;background:rgba(243,156,18,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-md);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f39c12" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h3 style="color:#f39c12;margin-bottom:var(--space-sm);">Application Under Review</h3>
          <p style="color:var(--text-secondary);font-size:14px;">Your verification application is being reviewed by our team. This usually takes 1-3 business days.</p>
          <p style="color:var(--text-muted);font-size:12px;">Submitted ${UI.formatDate(data.created_at)}</p>
        </div>`;
      return;
    }
    
    if (data.status === 'rejected') {
      formCard.style.display = 'block';
      statusCard.style.display = 'block';
      statusCard.innerHTML = `
        <div class="card-body" style="padding:var(--space-lg);">
          <div style="display:flex;align-items:center;gap:var(--space-md);margin-bottom:var(--space-md);">
            <div style="width:48px;height:48px;border-radius:50%;background:rgba(231,76,60,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <div>
              <h4 style="color:#e74c3c;margin:0;">Application Rejected</h4>
              <p style="font-size:13px;color:var(--text-secondary);margin:0;">${data.admin_notes || 'Please review your information and reapply.'}</p>
            </div>
          </div>
          <p style="font-size:12px;color:var(--text-muted);">Rejected on ${UI.formatDate(data.reviewed_at)}</p>
        </div>`;
      return;
    }
  } catch (_) {
    UI.toast('Could not load verification status', 'error');
  }
}
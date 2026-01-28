document.addEventListener('DOMContentLoaded', async () => {
  // 1. The Anchor (Shine) Logic - Slider Implementation
  const anchorSlider = document.querySelector('.anchor-slider');
  const slides = document.querySelectorAll('.anchor-slide');
  const dots = document.querySelectorAll('.dot');
  const anchorWidget = document.querySelector('.widget-anchor');
  let currentSlide = 0;
  
  function updateSlider(index) {
      if(index < 0) index = 0;
      if(index >= slides.length) index = slides.length - 1;
      currentSlide = index;
      
      if(anchorSlider) anchorSlider.style.transform = `translateX(-${currentSlide * 33.333}%)`;
      
      dots.forEach(d => d.classList.remove('active'));
      if(dots[currentSlide]) dots[currentSlide].classList.add('active');

      // Update Theme based on Slide
      if(anchorWidget) {
          anchorWidget.classList.remove('mode-shine', 'mode-home', 'mode-future');
          
          if(index === 0) {
              // Default Slide -> Default Theme
              anchorWidget.classList.add('mode-shine'); 
          } else if (index === 1) {
              // Present Slide -> Check dataset.theme
              const theme = slides[1].dataset.theme || 'shine';
              anchorWidget.classList.add(`mode-${theme}`);
          } else if (index === 2) {
              // Future Slide
              anchorWidget.classList.add('mode-future');
          }
      }
  }
  
  // Touch/Mouse Events for Slider
  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  
  const sliderContainer = document.querySelector('.anchor-slider-container');
  if(sliderContainer) {
      // Touch
      sliderContainer.addEventListener('touchstart', (e) => {
          if (e.target.closest('.plan-quick-view-panel')) return; 
          startX = e.touches[0].clientX;
          currentX = startX;
          isDragging = true;
      });
      sliderContainer.addEventListener('touchmove', (e) => {
          if (!isDragging) return;
          currentX = e.touches[0].clientX;
      });
      sliderContainer.addEventListener('touchend', (e) => {
          if (!isDragging) return;
          const diff = startX - currentX;
          if(Math.abs(diff) > 50) { // Threshold
              if(diff > 0) updateSlider(currentSlide + 1); // Swipe Left -> Next
              else updateSlider(currentSlide - 1); // Swipe Right -> Prev
          }
          isDragging = false;
      });

      // Mouse
      sliderContainer.addEventListener('mousedown', (e) => {
          if (e.target.closest('.plan-quick-view-panel')) return;
          startX = e.clientX;
          isDragging = true;
      });
       sliderContainer.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          currentX = e.clientX;
      });
      sliderContainer.addEventListener('mouseup', (e) => {
          if (!isDragging) return;
          const diff = startX - e.clientX; 
           if(Math.abs(diff) > 50) {
              if(diff > 0) updateSlider(currentSlide + 1);
              else updateSlider(currentSlide - 1);
          }
          isDragging = false;
      });
      sliderContainer.addEventListener('mouseleave', () => isDragging = false);
  }

  // Dot Click
  dots.forEach(dot => {
      dot.addEventListener('click', () => {
          const index = parseInt(dot.getAttribute('data-index'));
          updateSlider(index);
      });
  });

  // --- Plan Quick View Logic ---
  async function openPlanQuickView(circleEl, planId, planSummary) {
      activeQuickViewPlanId = planId;
      activeSourceElement = circleEl;

      // 1. Setup UI & Morph
    // Determine Parent Container (The Future SLIDE, not just the widget)
    // We must find the specific .anchor-slide so the panel moves with it
    const targetParent = circleEl.closest('.anchor-slide') || circleEl.closest('.widget-anchor') || document.body;
    
    let overlay = document.querySelector('.plan-quick-view-overlay');
      if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'plan-quick-view-overlay';
          document.body.appendChild(overlay); // Overlay still goes to body covers everything
          overlay.addEventListener('click', closePlanQuickView);
      }
      
      let panel = document.querySelector('.plan-quick-view-panel');
      if (!panel) {
          panel = document.createElement('div');
          panel.className = 'plan-quick-view-panel';
          panel.innerHTML = `
              <div class="morph-placeholder"></div>
              <div class="plan-quick-view-content" style="opacity:0">
                  <div class="quick-view-header">
                      <h3 class="quick-view-title"></h3>
                      <div class="quick-view-actions">
                          <button class="quick-view-btn" id="qv-edit-btn" title="进入编辑">
                               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                          <button class="quick-view-btn" id="qv-close-btn" title="关闭">
                               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                      </div>
                  </div>
                  <div class="quick-view-body">
                      <div class="quick-view-days" id="qv-days"></div>
                      <div class="quick-view-items" id="qv-items"></div>
                  </div>
              </div>
          `;
          targetParent.appendChild(panel); // Append to the widget!
          document.getElementById('qv-close-btn').addEventListener('click', closePlanQuickView);

          const itemsList = panel.querySelector('#qv-items');
          const daysList = panel.querySelector('#qv-days');
          if (itemsList && daysList && !itemsList.dataset.swipeBound) {
              itemsList.dataset.swipeBound = 'true';
              
              let itemStartX = 0;
              let itemStartY = 0;

              function swipeToDay(delta) {
                  const chips = daysList.querySelectorAll('.quick-view-day-chip');
                  if (!chips.length) return;
                  
                  let activeIndex = 0;
                  chips.forEach((chip, idx) => {
                      if (chip.classList.contains('active')) activeIndex = idx;
                  });
                  
                  const nextIndex = activeIndex + delta;
                  if (nextIndex < 0 || nextIndex >= chips.length) return;
                  
                  const targetChip = chips[nextIndex];
                  targetChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }

              itemsList.addEventListener('touchstart', (e) => {
                  if (!e.touches || !e.touches.length) return;
                  itemStartX = e.touches[0].clientX;
                  itemStartY = e.touches[0].clientY;
              }, { passive: true });

              itemsList.addEventListener('touchend', (e) => {
                  if (!e.changedTouches || !e.changedTouches.length) return;
                  const endX = e.changedTouches[0].clientX;
                  const endY = e.changedTouches[0].clientY;
                  const diffX = itemStartX - endX;
                  const diffY = itemStartY - endY;

                  if (Math.abs(diffX) > 25 && Math.abs(diffX) > Math.abs(diffY)) {
                      if (diffX > 0) swipeToDay(1);
                      else swipeToDay(-1);
                  }
              }, { passive: true });
          }
      } else if (panel.parentNode !== targetParent) {
          // If panel exists but is in wrong place (e.g. from previous open), move it
          targetParent.appendChild(panel);
      }

      // Ensure structure matches expectation (if panel existed)
      // Removed placeholder logic since we don't want extra animations
      let contentContainer = panel.querySelector('.plan-quick-view-content');
      if (!contentContainer) {
          // Wrap existing content if it wasn't wrapped
          const innerHTML = panel.innerHTML;
          panel.innerHTML = `<div class="plan-quick-view-content" style="opacity:0">${innerHTML}</div>`;
          contentContainer = panel.querySelector('.plan-quick-view-content');
          // Re-bind close button
          const closeBtn = document.getElementById('qv-close-btn');
          if(closeBtn) closeBtn.addEventListener('click', closePlanQuickView);
      }

      // 2. Perform Animation
      // Calculate relative coordinates
      const parentRect = targetParent.getBoundingClientRect();
      const circleRect = circleEl.getBoundingClientRect();
      
      const startTop = circleRect.top - parentRect.top;
      const startLeft = circleRect.left - parentRect.left;
      
      contentContainer.style.opacity = '0';

      // Smart Positioning Logic (Relative to Parent)
    const panelWidth = 60; // Exact match to plan-circle width (60px)
    const panelHeight = 200; // Reduced height
    
    // Account for Parent Borders (Absolute positioning is inside borders)
    const parentStyle = window.getComputedStyle(targetParent);
    const borderLeft = parseFloat(parentStyle.borderLeftWidth) || 0;
    const borderTop = parseFloat(parentStyle.borderTopWidth) || 0;

    // Default: Align top with circle to create "drop down" effect
    // Since width matches, we just align lefts
    let targetLeft = startLeft - borderLeft;
    let targetTop = startTop - borderTop;

    // Boundary checks (Relative to Parent Dimensions)
    const parentWidth = targetParent.offsetWidth;
    const parentHeight = targetParent.offsetHeight;
    const margin = 10;

    if (targetLeft < margin) targetLeft = margin;
    if (targetLeft + panelWidth > parentWidth - margin) targetLeft = parentWidth - panelWidth - margin;
    
    // Vertical check: if it goes off bottom, maybe shift up slightly, but prefer "drop down" feel
    if (targetTop + panelHeight > parentHeight - margin) {
        // If not enough space below, shift up just enough to fit
        targetTop = parentHeight - panelHeight - margin;
    }

    // Elevate parent widget z-index
    targetParent.classList.add('widget-elevated');

    panel.style.transition = 'none';
    panel.style.display = 'block';
    panel.style.top = `${startTop}px`;
    panel.style.left = `${startLeft}px`;
    panel.style.width = `${circleRect.width}px`;
    panel.style.height = `${circleRect.height}px`;
    panel.style.borderRadius = '50%';
    panel.style.opacity = '1';
    panel.classList.remove('expanded');

    // Hide source element
    circleEl.style.visibility = 'hidden';
    
    // Force Reflow
    panel.offsetHeight;

    // Animate
    requestAnimationFrame(() => {
        panel.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        overlay.classList.add('active');
        panel.classList.add('expanded');

        panel.style.top = `${targetTop}px`;
        panel.style.left = `${targetLeft}px`;
        panel.style.width = `${panelWidth}px`;
        panel.style.height = `${panelHeight}px`; 
        // Remove border radius animation since panel is invisible
        panel.style.borderRadius = '0';
    });

    // Fade out placeholder when items are ready (simulated delay for effect)
    setTimeout(() => {
        // if(placeholder) placeholder.style.opacity = '0';
        if(contentContainer) contentContainer.style.opacity = '1';
    }, 100); // Faster reveal for "direct" feel
      
      // Update Header
      const titleEl = panel.querySelector('.quick-view-title');
      if(titleEl) titleEl.textContent = planSummary.title || '未命名计划';
      
      const editBtn = document.getElementById('qv-edit-btn');
      if(editBtn) {
          // Direct onclick assignment to ensure cleanliness
          editBtn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              console.log('Navigating to planner:', planId);
              window.location.href = `planner.html?id=${planId}`;
          };
      }

      // 3. Load Data
      const stateKey = `hkwl_plan_state_${planId}`;
      const wishlistKey = `hkwl_wishlist_${planId}`;
      let planState = { days: [[]], titles: [] };
      let allItems = [];
      let isDataLoaded = false;

      // 3a. Try Local Storage
      try {
          const s = localStorage.getItem(stateKey);
          if (s) {
              planState = JSON.parse(s);
              if (planState.days && planState.days.length > 0) isDataLoaded = true;
          }
          const i = localStorage.getItem(wishlistKey);
          if (i) {
              allItems = JSON.parse(i);
              if (allItems.length > 0) isDataLoaded = true;
          }
      } catch(e) { console.error(e); }

      // 3b. Fetch from API if needed
      const daysContainer = document.getElementById('qv-days');
      const itemsContainer = document.getElementById('qv-items');
      
      if (!isDataLoaded && (planSummary.isCloud || planSummary.cloudId)) {
          // Show spinner in items if really needed, but we have placeholder text
          // itemsContainer.innerHTML = '...'; 
          
          try {
              const cloudId = planSummary.cloudId || planSummary.id;
              if (typeof CloudSync !== 'undefined' && CloudSync.isLoggedIn()) {
                   console.log("Fetching plan details from cloud:", cloudId);
                   const res = await CloudSync.getPlan(cloudId);
                   
                   if (res.success && res.plan && res.plan.content) {
                       const content = res.plan.content;
                       const cloudState = content.planState || { days: [[]], titles: [] };
                       const cloudItems = content.items || [];
                       
                       planState = cloudState;
                       allItems = cloudItems;
                       
                       if (!planState.days) planState.days = [[]];
                       if (!planState.titles) planState.titles = [];
                       
                       localStorage.setItem(stateKey, JSON.stringify(planState));
                       localStorage.setItem(wishlistKey, JSON.stringify(allItems));
                       // Update snapshot for 3-way merge
                       localStorage.setItem(wishlistKey + '_snapshot', JSON.stringify(allItems));
                       isDataLoaded = true;
                   }
              }
          } catch(e) {
              console.error("Cloud fetch failed", e);
              if(itemsContainer) itemsContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#f44336;">数据同步失败</div>';
          }
      }

      // 4. Render Data
      if(daysContainer) {
          daysContainer.innerHTML = '';
          daysContainer.style.opacity = '1'; // Ensure visible after re-opening
      }
      if(itemsContainer) itemsContainer.innerHTML = '';
      
      const header = panel.querySelector('.quick-view-header');
      if(header) header.style.opacity = '1'; // Ensure visible after re-opening
      
      const days = (planState.days && Array.isArray(planState.days)) ? planState.days : [[]];
      
      // Render Day Chips with Staggered Animation & Scroll Snap Logic
      days.forEach((dayItems, index) => {
          const chip = document.createElement('div');
          chip.className = 'quick-view-day-chip' + (index === 0 ? ' active' : '');
          
          let title = `第 ${index + 1} 天`;
          if (planState.titles && planState.titles[index]) {
             const t = planState.titles[index];
             if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
                 const d = new Date(t);
                 title = `${d.getMonth()+1}月${d.getDate()}日`;
             } else if (!isNaN(Date.parse(t))) {
                 const d = new Date(t);
                 title = `${d.getMonth()+1}月${d.getDate()}日`;
             } else if (t) {
                 title = t;
             }
          }
          
          chip.textContent = title;
          chip.onclick = () => {
              // Smooth scroll to this item, triggering the scroll listener
              chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          };
          
          // Add staggered delay
          chip.style.transitionDelay = `${0.1 + (index * 0.05)}s`;
          daysContainer.appendChild(chip);
      });

      // Add Scroll Listener for "Carousel" effect
      let scrollTimeout;
      daysContainer.onscroll = () => {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
              const center = daysContainer.scrollLeft + daysContainer.offsetWidth / 2;
              let closestIndex = 0;
              let minDiff = Infinity;
              
              const chips = daysContainer.querySelectorAll('.quick-view-day-chip');
              chips.forEach((chip, idx) => {
                 const chipCenter = chip.offsetLeft + chip.offsetWidth / 2;
                 const diff = Math.abs(center - chipCenter);
                 if (diff < minDiff) {
                     minDiff = diff;
                     closestIndex = idx;
                 }
              });
              
              const currentActive = daysContainer.querySelector('.quick-view-day-chip.active');
              const newActive = chips[closestIndex];
              
              if (newActive && currentActive !== newActive) {
                  if(currentActive) currentActive.classList.remove('active');
                  newActive.classList.add('active');
                  renderItemsForDay(closestIndex);
                  
                  // Update Header with Date
                  const titleEl = panel.querySelector('.quick-view-title');
                  if(titleEl) {
                      const t = newActive.textContent; // Get date text from chip
                      titleEl.textContent = t;
                  }
              }
          }, 50); // Fast debounce
      };
      
      // Helper: Render Items with Staggered Animation
      function renderItemsForDay(dayIdx) {
          if(!itemsContainer) return;
          
          // Update Header with Date for initial render too
          const titleEl = panel.querySelector('.quick-view-title');
          const chip = daysContainer.querySelectorAll('.quick-view-day-chip')[dayIdx];
          if(titleEl && chip) {
               titleEl.textContent = chip.textContent;
          }

          itemsContainer.innerHTML = '';
          const itemIds = days[dayIdx] || [];
          const items = itemIds.map(id => allItems.find(x => x.id === id)).filter(Boolean);
          
          if (items.length === 0) {
              const empty = document.createElement('div');
              empty.className = 'quick-view-empty';
              empty.textContent = '本天暂无安排';
              empty.style.opacity = '0';
              empty.style.transform = 'translateY(20px) scale(0.9)';
              empty.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s';
              itemsContainer.appendChild(empty);
              
              requestAnimationFrame(() => {
                  empty.style.opacity = '1';
                  empty.style.transform = 'translateY(0) scale(1)';
              });
              return;
          }
          
          items.forEach((item, i) => {
              const el = document.createElement('div');
              el.className = 'quick-view-item';
              // Set delay based on index for "splitting" effect
              el.style.transitionDelay = `${0.2 + (i * 0.08)}s`;
              
              // Set item height to reduced size (40px)
            el.style.height = '40px';
            el.innerHTML = `
                <div class="quick-view-item-content">
                    <div class="quick-view-item-title">${item.name}</div>
                    <div class="quick-view-item-meta">${item.desc || ''}</div>
                </div>
            `;
              itemsContainer.appendChild(el);
          });
      }
      
      function getItemColor(type) {
          if(type==='food') return '#e67e22';
          if(type==='stay') return '#8e44ad';
          if(type==='transport') return '#2980b9';
          return '#27ae60';
      }

      // Initial Render
      renderItemsForDay(0);

      // 5. Reveal Content (Fade In)
      // Transition is handled by the timeout above in openPlanQuickView
      // But we can ensure it's visible if render is slow
      if(contentContainer && contentContainer.style.opacity === '0') {
          // contentContainer.style.opacity = '1'; // Let the animation timeout handle it
      }
  }
  
  function closePlanQuickView() {
      const overlay = document.querySelector('.plan-quick-view-overlay');
      const panel = document.querySelector('.plan-quick-view-panel');
      const contentContainer = panel ? panel.querySelector('.plan-quick-view-content') : null;

      if (overlay) overlay.classList.remove('active');

      if (panel && typeof activeSourceElement !== 'undefined' && activeSourceElement) {
        // Remove elevated class from parent widget
        const parent = activeSourceElement.closest('.widget-anchor');
        if (parent) parent.classList.remove('widget-elevated');

        // Suck items back up
        const items = panel.querySelectorAll('.quick-view-item');
        items.forEach((item, i) => {
            item.style.transition = `all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.05}s`; // Reverse stagger
            item.style.transform = 'translateY(-20px) scale(0.5)';
            item.style.opacity = '0';
        });

        // Fade out header and days
        const header = panel.querySelector('.quick-view-header');
        const days = panel.querySelector('.quick-view-days');
        if(header) {
             header.style.transition = 'opacity 0.2s ease';
             header.style.opacity = '0';
        }
        if(days) {
            days.style.transition = 'opacity 0.2s ease';
            days.style.opacity = '0';
        }
        
        // Animate back to source
        const rect = activeSourceElement.getBoundingClientRect();
        
        // Calculate relative coordinates if parent exists
        let targetTop = rect.top;
        let targetLeft = rect.left;
        
        if (parent) {
            const parentRect = parent.getBoundingClientRect();
            targetTop = rect.top - parentRect.top;
            targetLeft = rect.left - parentRect.left;
        }

        // Wait a bit for items to disappear before shrinking panel (though panel is transparent, so this is mostly logical)
        setTimeout(() => {
             panel.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
             panel.style.top = `${targetTop}px`;
             panel.style.left = `${targetLeft}px`;
             panel.style.width = `${rect.width}px`;
             panel.style.height = `${rect.height}px`;
             panel.style.borderRadius = '50%'; // This won't be visible on transparent panel, but good for logic
             panel.classList.remove('expanded');
        }, 100);

        // Cleanup after animation
          setTimeout(() => {
              if (activeSourceElement) activeSourceElement.style.visibility = '';
              panel.style.display = 'none';
              panel.style.opacity = ''; // Reset to CSS default (0)
              
              // Reset items state for next open
              if(header) header.style.opacity = '';
              if(days) days.style.opacity = '';
              
              activeSourceElement = null;
              if (typeof activeQuickViewPlanId !== 'undefined') activeQuickViewPlanId = null;
          }, 500);
      } else {
          if (panel) {
               panel.style.display = 'none';
               panel.classList.remove('expanded');
          }
          if (typeof activeQuickViewPlanId !== 'undefined') activeQuickViewPlanId = null;
      }
  }

  // Inject Status Badge if not exists
  let statusBadge = document.querySelector('.anchor-status');
  if (!statusBadge && anchorWidget) {
      statusBadge = document.createElement('div');
      statusBadge.className = 'anchor-status';
      anchorWidget.appendChild(statusBadge);
  }

  // Load plans using HKWL (Core Logic)
  let plans = [];
  if (typeof HKWL !== 'undefined' && HKWL.getPlans) {
      plans = HKWL.getPlans();
  } else {
      // Fallback (Legacy)
      const plansData = localStorage.getItem('plans');
      plans = plansData ? JSON.parse(plansData) : [];
  }

  // Filter plans (Required for Present Slide logic below)
  const inProgressPlans = plans.filter(p => p.status === 'in_progress');

  // Define render function for reuse
  function renderFuturePlans(plansList) {
      const futureListPlans = plansList.filter(p => p.status !== 'in_progress'); 
      const futurePlansContainer = document.getElementById('future-plans-container');
      
      if (futurePlansContainer) {
          futurePlansContainer.innerHTML = '';
          
          // Render each plan as a circle
          futureListPlans.forEach(plan => {
              const circle = document.createElement('div'); // Changed from 'a' to 'div' for better control
              circle.className = `plan-circle status-${plan.status || 'planning'}`;
              circle.dataset.title = plan.title || '未命名计划';
              circle.dataset.id = plan.id; // Store ID
              
              // Use first letter of title as icon
              const firstLetter = (plan.title || 'P').charAt(0).toUpperCase();
              circle.textContent = firstLetter;
              
              // Click Handler - Direct Navigation to Planner
               circle.addEventListener('click', (e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   window.location.href = `planner.html?id=${plan.id}`;
               });
              
              futurePlansContainer.appendChild(circle);
          });
          
          // Add "+" button at the end
          const addBtn = document.createElement('a');
          addBtn.href = '#'; 
          addBtn.className = 'plan-circle add-btn';
          addBtn.dataset.title = '创建新计划';
          addBtn.textContent = '+';
          addBtn.addEventListener('click', async (e) => {
              e.preventDefault();
              if (addBtn.dataset.creating) return;
              
              addBtn.dataset.creating = 'true';
              const originalText = addBtn.textContent;
              addBtn.textContent = '...';
              
              try {
                  if (typeof HKWL !== 'undefined' && HKWL.createPlan) {
                      const id = await HKWL.createPlan("新计划");
                      if (id) {
                          window.location.href = `planner.html?id=${id}`;
                      } else {
                          // createPlan might have shown an alert or failed silently
                          addBtn.textContent = originalText;
                          addBtn.dataset.creating = '';
                      }
                  } else {
                      console.error('HKWL.createPlan not available');
                      alert('无法创建计划，请刷新重试');
                      addBtn.textContent = originalText;
                      addBtn.dataset.creating = '';
                  }
              } catch (err) {
                  console.error('Create plan failed', err);
                  alert('创建失败: ' + err.message);
                  addBtn.textContent = originalText;
                  addBtn.dataset.creating = '';
              }
          });
          futurePlansContainer.appendChild(addBtn);
      }
  }

  // Initial Render
  renderFuturePlans(plans);

  // Background Sync for Shared Plans
  if (typeof HKWL !== 'undefined' && HKWL.fetchAndMergeCloudPlans) {
      HKWL.fetchAndMergeCloudPlans().then(updatedPlans => {
          if (updatedPlans && updatedPlans.length > 0) {
              // Re-render if we got updates
              // Check if plans actually changed to avoid unnecessary DOM updates could be better,
              // but for now just re-render is safe.
              renderFuturePlans(updatedPlans);
          }
      }).catch(err => {
          console.error("Background plan sync failed", err);
      });
  }

  // Helper to get home info
  async function getHomeInfo() {
      try {
          const token = sessionStorage.getItem('hkwl_auth_token');
          if (!token) return null;
          const res = await fetch('/api/auth/status', {
              headers: { 'Authorization': token }
          });
          const data = await res.json();
          return (data.success && data.home && data.home.name) ? data.home : null;
      } catch (e) {
          console.warn('Failed to fetch home info', e);
          return null;
      }
  }

  const homeInfo = await getHomeInfo();

  // Populate Slides
  
  // 3. Future Slide (Plan Circles Logic) - Handled by renderFuturePlans() above

  // Switch to Future Button Logic (My Plans)
  const switchToFutureBtn = document.querySelector('.switch-to-future');
  if (switchToFutureBtn) {
      switchToFutureBtn.addEventListener('click', (e) => {
          e.preventDefault();
          updateSlider(2); // Index 2 is Future slide
      });
  }

  // 1. Default Slide (Wander Mode Logic)
  const defaultTitle = document.querySelector('.slide-default .anchor-title');
  const defaultMessage = document.querySelector('.slide-default .anchor-message');
  
  // Always fetch random content for Default Slide
  try {
      const res = await fetch('/api/content/random?module=anchor');
      const data = await res.json();
      if (data.success && data.content) {
           if (data.content.title && defaultTitle) defaultTitle.textContent = data.content.title;
           if (data.content.content && defaultMessage) defaultMessage.textContent = data.content.content;
      }
  } catch (e) {
      console.warn('Anchor fetch failed', e);
  }

  // 2. Present Slide (Active Plan / Home Mode Logic)
  const presentSlide = document.querySelector('.slide-present');
  const presentTitle = document.querySelector('.slide-present .anchor-title');
  const presentMessage = document.querySelector('.slide-present .anchor-message');
  const presentBtn = document.querySelector('.slide-present .shine-btn');

  // Check for Pending Notifications (Friend Requests, Plan Invites, System Alerts)
    let pendingNotifications = [];
    if (typeof Mailbox !== 'undefined' && Mailbox.getPendingNotifications) {
        pendingNotifications = await Mailbox.getPendingNotifications();
    }

    if (pendingNotifications.length > 0) {
        // Notification Mode
        const notif = pendingNotifications[0];
        
        if(presentMessage) {
            presentMessage.innerHTML = '';
            
            const card = document.createElement('div');
            card.className = 'invitation-card';
            
            const content = document.createElement('div');
            content.style.marginBottom = '1rem';
            content.style.fontSize = '1.1rem';
            content.style.lineHeight = '1.5';
            
            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '1rem';
            actions.style.justifyContent = 'center';

            if (notif.kind === 'friend_request') {
                if(presentTitle) presentTitle.textContent = 'New Friend Request 👥';
                const req = notif.data;
                content.innerHTML = `<strong>${req.fromNickname || req.from}</strong> 请求添加你为好友`;
                
                const acceptBtn = document.createElement('button');
                acceptBtn.textContent = '接受';
                acceptBtn.className = 'shine-btn-primary';
                acceptBtn.onclick = async () => {
                    acceptBtn.disabled = true;
                    acceptBtn.textContent = '...';
                    try {
                        await CloudSync.respondFriendRequest(req.from, 'accept');
                        window.location.reload();
                    } catch(e) { alert("操作失败"); acceptBtn.disabled = false; }
                };
                
                const rejectBtn = document.createElement('button');
                rejectBtn.textContent = '拒绝';
                rejectBtn.className = 'shine-btn-secondary';
                rejectBtn.onclick = async () => {
                    if(!confirm('确定要拒绝吗？')) return;
                    rejectBtn.disabled = true;
                    try {
                        await CloudSync.respondFriendRequest(req.from, 'reject');
                        window.location.reload();
                    } catch(e) { alert("操作失败"); rejectBtn.disabled = false; }
                };
                actions.appendChild(acceptBtn);
                actions.appendChild(rejectBtn);

            } else if (notif.kind === 'plan_invitation') {
                if(presentTitle) presentTitle.textContent = 'New Invitation 📬';
                const invite = notif.data;
                const senderName = invite.senderDisplay || invite.sender;
                content.innerHTML = `<strong>${senderName}</strong> 邀请你加入计划<br>"${invite.metadata.planTitle || '未命名计划'}"`;

                const joinBtn = document.createElement('button');
                joinBtn.textContent = '加入旅程';
                joinBtn.className = 'shine-btn-primary';
                joinBtn.onclick = async () => {
                    joinBtn.disabled = true;
                    joinBtn.textContent = '处理中...';
                    try {
                        const myId = Auth.getFriendId();
                        const res = await CloudSync.approveInvitation(invite.metadata.planId, myId);
                        if (res && res.success) {
                            // Mark message as read
                            await CloudSync.markMessageRead(invite._id);
                            window.location.reload();
                        } else {
                            alert("加入失败: " + (res.error || '未知错误'));
                            joinBtn.disabled = false;
                            joinBtn.textContent = '加入旅程';
                        }
                    } catch(e) {
                        alert("操作失败");
                        joinBtn.disabled = false;
                        joinBtn.textContent = '加入旅程';
                    }
                };

                const ignoreBtn = document.createElement('button');
                ignoreBtn.textContent = '忽略';
                ignoreBtn.className = 'shine-btn-secondary';
                ignoreBtn.onclick = async () => {
                    if(!confirm('确定要拒绝这个邀请吗？')) return;
                    ignoreBtn.disabled = true;
                    try {
                        const myId = Auth.getFriendId();
                        await CloudSync.rejectInvitation(invite.metadata.planId, myId);
                        // Mark message as read
                        await CloudSync.markMessageRead(invite._id);
                        window.location.reload();
                    } catch(e) {
                        alert("操作失败");
                        ignoreBtn.disabled = false;
                    }
                };
                actions.appendChild(joinBtn);
                actions.appendChild(ignoreBtn);

            } else if (notif.kind === 'system_notification') {
                const msg = notif.data;
                if (msg.type === 'notification') {
                    if(presentTitle) presentTitle.textContent = 'New Notification 🔔';
                    content.innerHTML = msg.content;
                } else {
                    if(presentTitle) presentTitle.textContent = 'System Notification 📢';
                    content.innerHTML = `<strong>系统通知:</strong><br>${msg.content}`;
                }
                
                const readBtn = document.createElement('button');
                readBtn.textContent = '我知道了';
                readBtn.className = 'shine-btn-primary';
                readBtn.onclick = async () => {
                    readBtn.disabled = true;
                    try {
                        await CloudSync.markMessageRead(msg._id);
                        window.location.reload();
                    } catch(e) { alert("操作失败"); readBtn.disabled = false; }
                };
                actions.appendChild(readBtn);
            } else if (notif.kind === 'announcement') {
                if(presentTitle) presentTitle.textContent = 'New Announcement 📢';
                const notice = notif.data;
                // Limit height for long announcements
                content.innerHTML = `<div style="max-height: 200px; overflow-y: auto; text-align: left; background: rgba(255,255,255,0.5); padding: 10px; border-radius: 8px;">${notice.content}</div>`;
                
                const ackBtn = document.createElement('button');
                ackBtn.textContent = '收到';
                ackBtn.className = 'shine-btn-primary';
                ackBtn.onclick = async () => {
                    ackBtn.disabled = true;
                    try {
                        // Mark notice as read
                        await fetch('/api/notice/ack', {
                            method: 'POST',
                            headers: { 'Authorization': sessionStorage.getItem('hkwl_auth_token') }
                        });
                        window.location.reload();
                    } catch(e) { alert("操作失败"); ackBtn.disabled = false; }
                };
                actions.appendChild(ackBtn);
            }

            card.appendChild(content);
            card.appendChild(actions);
            presentMessage.appendChild(card);
        }
        
        if(presentBtn) presentBtn.style.display = 'none';

        // Set status badge
        if(statusBadge) {
            statusBadge.textContent = '🔔 待处理事项';
            statusBadge.className = 'anchor-status status-shine';
        }
        if(presentSlide) presentSlide.dataset.theme = 'shine';
        updateSlider(1); // Auto switch to Present

    } else if (inProgressPlans.length > 0) {
      // Active Plan Mode (In Progress)
      if(presentTitle) presentTitle.textContent = `Time to Shine ✨`;
      
      // Clear message and hide button as requested
      if(presentMessage) presentMessage.innerHTML = '';
      if(presentBtn) presentBtn.style.display = 'none';

      // Create container for plans
      let container = presentSlide.querySelector('.plan-circles-container');
      if (!container) {
          container = document.createElement('div');
          container.className = 'plan-circles-container';
          // Append to anchor-content
          if(presentMessage && presentMessage.parentNode) {
              presentMessage.parentNode.appendChild(container);
          }
      }
      container.innerHTML = '';

      inProgressPlans.forEach(plan => {
           const circle = document.createElement('a');
           circle.href = `planner.html?id=${plan.id}`;
           circle.className = `plan-circle status-${plan.status || 'in_progress'}`;
           circle.dataset.title = plan.title || '未命名计划';
           
           const firstLetter = (plan.title || 'P').charAt(0).toUpperCase();
           circle.textContent = firstLetter;
           
           container.appendChild(circle);
      });

      // Set status badge
      if(statusBadge) {
          statusBadge.textContent = '✈️ 旅程进行中';
          statusBadge.className = 'anchor-status status-shine';
      }
      if(presentSlide) presentSlide.dataset.theme = 'shine';
      // Auto switch to Present slide if there is an active plan
      updateSlider(1); 
  } else if (homeInfo) {
      if(presentBtn) presentBtn.style.display = '';
      // Home Mode
      if(presentTitle) presentTitle.textContent = 'Home Sweet Home';
      const homeName = homeInfo.name === '我的家' ? homeInfo.address : homeInfo.name;
      if(presentMessage) presentMessage.innerHTML = `我在 <strong>${homeName}</strong>，<br>心在远方，积蓄力量。`;
      if(presentBtn) {
          presentBtn.textContent = '规划新旅程';
          presentBtn.href = 'planner.html';
      }
       // Set status badge
      if(statusBadge) {
          statusBadge.textContent = '🏠 居家休整';
          statusBadge.className = 'anchor-status status-home';
      }
      if(presentSlide) presentSlide.dataset.theme = 'home';
      // Auto switch to Present slide
      updateSlider(1);
  } else {
      // No Plan & No Home -> Wander Mode
      if(presentBtn) presentBtn.style.display = '';
      // "Present" slide shows "No Active Tasks"
      if(presentTitle) presentTitle.textContent = '当下无事';
      if(presentMessage) presentMessage.textContent = '享受此刻的宁静。';
      if(presentBtn) {
          presentBtn.textContent = '创建计划';
          presentBtn.href = 'planner.html';
      }
       // Set status badge
      if(statusBadge) {
          statusBadge.textContent = '🌏 四海为家';
          statusBadge.className = 'anchor-status status-wander';
      }
      if(presentSlide) presentSlide.dataset.theme = 'shine';
      // Default to Default Slide
      updateSlider(0);
  }

  // 2. The Spark (Prism) & Window (CMS Content)
  
  // Default Wisdoms (Fallback)
  const wisdoms = [
    { icon: '🥢', text: '在日本，筷子横放代表用餐完毕。' },
    { icon: '🌋', text: '冰岛拥有世界上最纯净的空气。' },
    { icon: '🚆', text: '在瑞士，火车准点率高达 95%。' },
    { icon: '🎒', text: '极简旅行教给生活的断舍离。' },
    { icon: '🌌', text: '去年的今天，你在哪里？' }
  ];

  // Helper to get random item
  const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const sparkText = document.querySelector('.spark-text');
  const sparkIcon = document.querySelector('.spark-icon');

  // Fetch Spark Content
  try {
      const res = await fetch('/api/content/random?module=spark');
      const data = await res.json();
      
      if (data.success && data.content) {
          const item = data.content;
          
          // 1. Text
          if (sparkText) {
              sparkText.textContent = item.content || item.title || ''; 
              // If we have an image, maybe make text smaller or white with shadow?
              if (item.image) {
                  sparkText.style.textShadow = '0 2px 4px rgba(0,0,0,0.8)';
                  sparkText.style.color = 'white';
                  sparkText.style.zIndex = '2';
                  sparkText.style.position = 'relative';
              } else {
                  // Reset styles if no image
                  sparkText.style.textShadow = 'none';
                  sparkText.style.color = ''; 
              }
          }
          
          // 2. Image (Background)
          const sparkFront = document.querySelector('.spark-front');
          if (sparkFront) {
              if (item.image) {
                  sparkFront.style.backgroundImage = `url(${item.image})`;
                  sparkFront.style.backgroundSize = 'cover';
                  sparkFront.style.backgroundPosition = 'center';
                  // Add overlay for readability
                  let overlay = sparkFront.querySelector('.spark-overlay');
                  if (!overlay) {
                      overlay = document.createElement('div');
                      overlay.className = 'spark-overlay';
                      overlay.style.position = 'absolute';
                      overlay.style.top = '0';
                      overlay.style.left = '0';
                      overlay.style.width = '100%';
                      overlay.style.height = '100%';
                      overlay.style.background = 'rgba(0,0,0,0.3)';
                      overlay.style.zIndex = '1';
                      overlay.style.borderRadius = '24px'; // Match widget radius
                      sparkFront.insertBefore(overlay, sparkFront.firstChild);
                  }
              } else {
                  sparkFront.style.backgroundImage = 'none';
                  const overlay = sparkFront.querySelector('.spark-overlay');
                  if (overlay) overlay.remove();
              }
          }

          // 3. Icon (Only if no image, or as an accent)
          if (!item.image && sparkIcon) {
              const icons = ['🥢', '🌋', '🚆', '🎒', '🌌', '💡', '🔥', '✨'];
              sparkIcon.textContent = getRandom(icons);
              sparkIcon.style.display = 'block';
          } else if (item.image && sparkIcon) {
              // Hide icon if image is present to avoid clutter
              sparkIcon.style.display = 'none';
          }

      } else {
          // Fallback
          const w = getRandom(wisdoms);
          if (sparkText) sparkText.textContent = w.text;
          if (sparkIcon) sparkIcon.textContent = w.icon;
      }
  } catch (e) {
      console.warn('Spark fetch failed, using fallback', e);
      const w = getRandom(wisdoms);
      if (sparkText) sparkText.textContent = w.text;
      if (sparkIcon) sparkIcon.textContent = w.icon;
  }

  // Fetch Window Content
  const windowWidget = document.querySelector('.widget-window');
  if (windowWidget) {
      try {
          const res = await fetch('/api/content/random?module=window');
          const data = await res.json();
          
          if (data.success && data.content) {
              const item = data.content;
              
              // Image Handling
              if (item.image) { // New field
                   windowWidget.style.backgroundImage = `url(${item.image})`;
                   windowWidget.style.backgroundSize = 'cover';
                   windowWidget.style.backgroundPosition = 'center';
              } else if (item.content && (item.content.startsWith('http') || item.content.startsWith('data:'))) {
                   // Legacy: if content is URL
                   windowWidget.style.backgroundImage = `url(${item.content})`;
                   windowWidget.style.backgroundSize = 'cover';
                   windowWidget.style.backgroundPosition = 'center';
              }

              // Text Handling
              const title = windowWidget.querySelector('.window-title');
              if (title) {
                  title.textContent = item.title || item.content; // Use title if avail, else content
                  if (item.image) {
                      // If it's image + text
                      const contentDiv = windowWidget.querySelector('.window-content');
                      if (contentDiv) contentDiv.style.opacity = '1'; 
                  }
              }
          }
      } catch (e) {
          console.warn('Window fetch failed', e);
      }
  }
  


  // Mobile interaction for Spark widget (Double tap to flip)
  const sparkWidget = document.querySelector('.widget-spark');
  const sparkInner = document.querySelector('.spark-inner');
  
  if (sparkWidget && sparkInner) {
      let lastTap = 0;
      
      sparkWidget.addEventListener('touchend', (e) => {
          const currentTime = new Date().getTime();
          const tapLength = currentTime - lastTap;
          
          if (tapLength < 500 && tapLength > 0) {
              // Double tap detected
              e.preventDefault();
              if (sparkInner.style.transform === 'rotateY(180deg)') {
                  sparkInner.style.transform = 'rotateY(0deg)';
              } else {
                  sparkInner.style.transform = 'rotateY(180deg)';
              }
          }
          lastTap = currentTime;
      });

      // Also support click for desktop testing or simple tap if hover doesn't work well
      sparkWidget.addEventListener('click', () => {
        // Only trigger on mobile view width
        if (window.innerWidth <= 768) {
             if (sparkInner.style.transform === 'rotateY(180deg)') {
                  sparkInner.style.transform = 'rotateY(0deg)';
              } else {
                  sparkInner.style.transform = 'rotateY(180deg)';
              }
        }
      });
  }

  // 3. The Echo (Shone) Logic - Simple Stats
  const echoNumber = document.querySelector('.echo-number');
  const echoLabel = document.querySelector('.echo-label');
  
  if (plans.length > 0) {
    echoNumber.textContent = plans.length;
    echoLabel.textContent = '个精彩的旅程已记录';
  } else {
    echoNumber.textContent = '0';
    echoLabel.textContent = '期待你的第一个足迹';
  }

  // 4. Greeting Logic
  const headerBrand = document.querySelector('.header-brand');
  const hour = new Date().getHours();
  let greeting = 'shineshone';
  
  // Try to get username if logged in (this is a simplified check, ideally should use auth-manager)
  const currentUser = localStorage.getItem('currentUser');
  if (currentUser) {
    const userObj = JSON.parse(currentUser);
    if (hour < 12) greeting = `Good Morning, ${userObj.username}`;
    else if (hour < 18) greeting = `Good Afternoon, ${userObj.username}`;
    else greeting = `Good Evening, ${userObj.username}`;
    
    // Update header brand or add a sub-greeting
    // For now, let's keep the brand name but maybe add a tooltip or subtitle
  }
  
  // 5. Admin Console Link (Top Left)
  if (typeof Auth !== 'undefined') {
      Auth.refreshAdminStatus().then(() => {
          if (Auth.isAdmin()) {
              const header = document.querySelector('.site-header');
              if (header) {
                  const adminLink = document.createElement('a');
                  adminLink.href = 'admin.html';
                  adminLink.innerHTML = '🔧';
                  adminLink.title = '管理员控制台';
                  adminLink.style.textDecoration = 'none';
                  adminLink.style.fontSize = '1.2rem';
                  adminLink.style.marginLeft = '1rem';
                  adminLink.style.opacity = '0.7';
                  adminLink.style.transition = 'opacity 0.2s';
                  
                  adminLink.onmouseover = () => adminLink.style.opacity = '1';
                  adminLink.onmouseout = () => adminLink.style.opacity = '0.7';
                  
                  // Insert after brand container
                  const brandContainer = header.querySelector('.header-brand-container');
                  if (brandContainer) {
                      if (brandContainer.nextSibling) {
                          header.insertBefore(adminLink, brandContainer.nextSibling);
                      } else {
                          header.appendChild(adminLink);
                      }
                  } else {
                      // Fallback if container not found
                      header.appendChild(adminLink);
                  }
              }
          }
      });
  }
});

"use client";

import { useState, useEffect } from "react";
import { PlusIcon, PlayIcon, PauseIcon, TrashIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface Scraper {
  id: number;
  name: string;
  displayName: string;
  description: string;
  domain: string;
  enabled: boolean;
  updatedAt: string;
  stats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    lastRun: string;
    totalEventsFound: number;
  };
  eventPipeline?: {
    discovered: number;
    proposed: number;
    approved: number;
    registered: number;
  };
}

interface RequestScraperModal {
  isOpen: boolean;
  domain: string;
  description: string;
  isSubmitting: boolean;
}

interface DeleteConfirmModal {
  isOpen: boolean;
  scraper: Scraper | null;
  isDeleting: boolean;
}

export function ScrapersManagement() {
  const [scrapers, setScrapers] = useState<Scraper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('7'); // Default to 7 days
  
  const [requestModal, setRequestModal] = useState<RequestScraperModal>({
    isOpen: false,
    domain: '',
    description: '',
    isSubmitting: false
  });
  
  const [deleteModal, setDeleteModal] = useState<DeleteConfirmModal>({
    isOpen: false,
    scraper: null,
    isDeleting: false
  });

  useEffect(() => {
    fetchScrapers();
  }, [timeRange]); // Re-fetch when time range changes

  const fetchScrapers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3000/api/automation/scrapers?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch scrapers');
      }
      const data = await response.json();
      setScrapers(data);
    } catch (error) {
      console.error('Error fetching scrapers:', error);
      setError('Failed to load scrapers');
    } finally {
      setLoading(false);
    }
  };

  const toggleScraper = async (scraperId: number) => {
    try {
      const response = await fetch(`http://localhost:3000/api/automation/scrapers/${scraperId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle scraper');
      }
      
      const result = await response.json();
      
      // Update the scraper in the state
      setScrapers(prev => prev.map(scraper => 
        scraper.id === scraperId ? { ...scraper, enabled: result.enabled } : scraper
      ));
      
    } catch (error) {
      console.error('Error toggling scraper:', error);
      alert('Failed to toggle scraper. Please try again.');
    }
  };

  const runScraper = async (scraperId: number) => {
    try {
      const response = await fetch(`http://localhost:3000/api/automation/scrapers/${scraperId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to run scraper');
      }
      
      const result = await response.json();
      alert(`✅ ${result.message}`);
      
    } catch (error) {
      console.error('Error running scraper:', error);
      alert('Failed to run scraper. Please try again.');
    }
  };

  const deleteScraper = async (scraper: Scraper) => {
    setDeleteModal({
      isOpen: true,
      scraper,
      isDeleting: false
    });
  };

  const confirmDelete = async () => {
    if (!deleteModal.scraper) return;
    
    setDeleteModal(prev => ({ ...prev, isDeleting: true }));
    
    try {
      const response = await fetch(`http://localhost:3000/api/automation/scrapers/${deleteModal.scraper.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete scraper');
      }
      
      // Remove scraper from state
      setScrapers(prev => prev.filter(s => s.id !== deleteModal.scraper!.id));
      setDeleteModal({ isOpen: false, scraper: null, isDeleting: false });
      
    } catch (error) {
      console.error('Error deleting scraper:', error);
      alert('Failed to delete scraper. Please try again.');
      setDeleteModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const submitScraperRequest = async () => {
    if (!requestModal.domain.trim()) {
      alert('Please enter a domain');
      return;
    }

    setRequestModal(prev => ({ ...prev, isSubmitting: true }));

    try {
      const response = await fetch('http://localhost:3000/api/automation/scraper-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: requestModal.domain.trim(),
          description: requestModal.description.trim() || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit scraper request');
      }

      alert('✅ Scraper request submitted successfully! Sheridan has been notified via email.');
      setRequestModal({
        isOpen: false,
        domain: '',
        description: '',
        isSubmitting: false
      });

    } catch (error) {
      console.error('Error submitting scraper request:', error);
      alert('Failed to submit scraper request. Please try again.');
      setRequestModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-gray-900">🕰 Event Sources</h3>
            <div className="flex items-center space-x-2">
              <label htmlFor="timeRange" className="text-sm font-medium text-gray-700">
                Performance:
              </label>
              <select
                id="timeRange"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="1">Last 1 day</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </div>
          </div>
          <button 
            onClick={() => setRequestModal(prev => ({ ...prev, isOpen: true }))}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Request Scraper
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">
            <p>{error}</p>
            <button 
              onClick={fetchScrapers} 
              className="mt-2 text-sm underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {scrapers.map((scraper) => (
              <div 
                key={scraper.id} 
                className={`border rounded-lg p-4 transition-colors ${
                  scraper.enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h4 className="text-md font-medium text-gray-900 mr-3">{scraper.displayName}</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        scraper.enabled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {scraper.enabled ? '✓ Active' : '⏸ Paused'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{scraper.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <div className="font-medium text-gray-700 mb-1">Domain:</div>
                        <div className="text-gray-600">{scraper.domain}</div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-700 mb-1">Performance:</div>
                        <div className="text-gray-600">
                          {scraper.stats.successfulRuns}/{scraper.stats.totalRuns} successful runs
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-700 mb-1">Events Found:</div>
                        <div className="text-gray-600">
                          {scraper.stats.totalEventsFound} total events
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => toggleScraper(scraper.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        scraper.enabled
                          ? 'text-orange-600 hover:bg-orange-100'
                          : 'text-green-600 hover:bg-green-100'
                      }`}
                      title={scraper.enabled ? 'Pause scraper' : 'Resume scraper'}
                    >
                      {scraper.enabled ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                    </button>
                    
                    {scraper.enabled && (
                      <button 
                        onClick={() => runScraper(scraper.id)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                        title="Run this scraper now"
                      >
                        <PlayIcon className="h-4 w-4" />
                      </button>
                    )}
                    
                    <button 
                      onClick={() => deleteScraper(scraper)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg"
                      title="Delete scraper"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-gray-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="text-gray-600">
                      Last run: <span className="font-medium">{scraper.stats.lastRun}</span>
                    </div>
                    {scraper.stats.failedRuns > 0 && (
                      <div className="text-orange-600">
                        ⚠️ {scraper.stats.failedRuns} failed runs
                      </div>
                    )}
                  </div>
                  
                  {/* Event Pipeline Stats */}
                  {scraper.eventPipeline && (
                    <div className="text-xs">
                      <div className="font-medium text-gray-700 mb-1">Event Pipeline:</div>
                      <div className="flex items-center space-x-3 text-gray-600">
                        <span>{scraper.eventPipeline.discovered} discovered</span>
                        <span className="text-gray-400">→</span>
                        <span>{scraper.eventPipeline.proposed} sent</span>
                        <span className="text-gray-400">→</span>
                        <span>{scraper.eventPipeline.approved} approved</span>
                        <span className="text-gray-400">→</span>
                        <span>{scraper.eventPipeline.registered} registered</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {scrapers.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🤖</div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No scrapers found</h4>
            <p className="text-gray-600 mb-4">
              Request a new scraper to start discovering events from additional sources
            </p>
            <button 
              onClick={() => setRequestModal(prev => ({ ...prev, isOpen: true }))}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Request Your First Scraper
            </button>
          </div>
        )}
      </div>

      {/* Request Scraper Modal */}
      {requestModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Request New Scraper</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Domain *
                </label>
                <input
                  type="text"
                  value={requestModal.domain}
                  onChange={(e) => setRequestModal(prev => ({ ...prev, domain: e.target.value }))}
                  placeholder="example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={requestModal.description}
                  onChange={(e) => setRequestModal(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the events on this site..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setRequestModal({ isOpen: false, domain: '', description: '', isSubmitting: false })}
                disabled={requestModal.isSubmitting}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitScraperRequest}
                disabled={requestModal.isSubmitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {requestModal.isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.scraper && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">Delete Scraper</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the scraper for <strong>{deleteModal.scraper.displayName}</strong>? 
              This action cannot be undone and will stop all future event discovery from this source.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, scraper: null, isDeleting: false })}
                disabled={deleteModal.isDeleting}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteModal.isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleteModal.isDeleting ? 'Deleting...' : 'Delete Scraper'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
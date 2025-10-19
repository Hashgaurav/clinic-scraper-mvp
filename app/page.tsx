'use client';

import { useState } from 'react';

interface AvailabilitySlot {
  date: string;
  time: string;
  doctor?: string;
}

interface AvailableDate {
  date: string;
  count: number;
}

interface ScrapingResult {
  clinic: string;
  availableDates: AvailableDate[];
  slots: AvailabilitySlot[];
  error?: string;
  cached?: boolean;
  cacheAge?: number;
  scrapedAt?: string;
  rawData?: any;
}

// URL will be loaded from environment variables

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [result, setResult] = useState<ScrapingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const handleScrape = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedDate(null);

    try {
      // Get the target URL from environment variables
      const response = await fetch('/api/scrape');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape data');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailabilityForMonth = async (month: Date) => {
    setMonthLoading(true);
    setError(null);

    try {
      const monthParam = month.toISOString().slice(0, 7); // YYYY-MM format
      const response = await fetch(`/api/scrape?month=${monthParam}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape data for month');
      }

      // Merge new data with existing result, or create new result
      setResult(prevResult => {
        if (!prevResult) {
          return data;
        }
        
        // Merge available dates and slots
        const mergedAvailableDates = [...prevResult.availableDates];
        const mergedSlots = [...prevResult.slots];
        
        // Add new dates that don't exist
        data.availableDates.forEach((newDate: any) => {
          if (!mergedAvailableDates.find(d => d.date === newDate.date)) {
            mergedAvailableDates.push(newDate);
          }
        });
        
        // Add new slots that don't exist
        data.slots.forEach((newSlot: any) => {
          if (!mergedSlots.find(s => s.date === newSlot.date && s.time === newSlot.time)) {
            mergedSlots.push(newSlot);
          }
        });
        
        return {
          ...prevResult,
          availableDates: mergedAvailableDates.sort((a, b) => a.date.localeCompare(b.date)),
          slots: mergedSlots.sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            return dateCompare !== 0 ? dateCompare : a.time.localeCompare(b.time);
          })
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch month data');
    } finally {
      setMonthLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getSlotsForSelectedDate = (slots: AvailabilitySlot[], date: string) => {
    return slots.filter(slot => slot.date === date);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const navigateMonth = async (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(currentMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    setCurrentMonth(newMonth);
    setSelectedDate(null); // Clear selected date when changing months
    
    // Fetch data for the new month
    await fetchAvailabilityForMonth(newMonth);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getAvailableDatesForMonth = (month: Date) => {
    if (!result) return [];
    
    const monthStr = month.toISOString().slice(0, 7); // YYYY-MM format
    return result.availableDates.filter(date => 
      date.date.startsWith(monthStr) && date.count > 0
    );
  };

  const getMonthsWithAppointments = () => {
    if (!result) return [];
    
    const months = new Set<string>();
    result.availableDates
      .filter(date => date.count > 0)
      .forEach(date => {
        const monthStr = date.date.slice(0, 7); // YYYY-MM format
        months.add(monthStr);
      });
    
    return Array.from(months).sort().map(monthStr => {
      const [year, month] = monthStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      const count = result.availableDates
        .filter(d => d.date.startsWith(monthStr) && d.count > 0)
        .reduce((sum, d) => sum + d.count, 0);
      
      return { monthStr, date, count };
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                🏥 Clinic Availability Scraper
              </h1>
              <p className="text-gray-600 mt-1">Real-time appointment availability monitoring</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Live</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Target Clinic Card */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">Target Clinic</h2>
                <p className="text-blue-100 text-sm mt-1">Aspit Booking System</p>
              </div>
              <div className="p-6">
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
                  <p className="text-sm text-gray-600 break-all font-mono">
                    Target URL configured via environment variables
                  </p>
                </div>
                <button
                  onClick={handleScrape}
                  disabled={loading}
                  className="mt-4 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Scraping Availability...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Fetch Availability</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Results Section */}
            {error && (
              <div className="bg-white rounded-xl shadow-lg border border-red-200 overflow-hidden">
                <div className="bg-red-50 px-6 py-4 border-b border-red-200">
                  <h3 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Error
                  </h3>
                </div>
                <div className="p-6">
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            )}

            {result && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">Scraping Results</h2>
                    <div className="flex items-center gap-2">
                      {result.cached ? (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          📋 Cached ({result.cacheAge}s ago)
                        </span>
                      ) : (
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          🔄 Fresh ({result.scrapedAt ? new Date(result.scrapedAt).toLocaleTimeString() : 'now'})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                  
                  {/* Clinic Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-800">🏥 {result.clinic}</h3>
                      {result.rawData?.environment === 'vercel' && (
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                          Demo Mode
                        </span>
                      )}
                    </div>
                    {result.rawData?.environment === 'vercel' && (
                      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="h-4 w-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium text-orange-800">Demo Mode Active</span>
                        </div>
                        <p className="text-orange-700 text-sm">Showing sample data - Playwright browsers not available in Vercel environment</p>
                      </div>
                    )}
                    {result.error && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800 text-sm">⚠️ {result.error}</p>
                      </div>
                    )}
                  </div>

                  {/* Month Navigation Calendar */}
                  {result.availableDates.filter(date => date.count > 0).length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Available Dates</h3>
                      <p className="text-gray-500">No appointment dates were found. This could mean no appointments are available or the scraper needs adjustment.</p>
                    </div>
                  ) : (
                    <div>
                      {/* Month Navigation Header */}
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-800">
                          📅 Browse Available Dates
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigateMonth('prev')}
                              disabled={monthLoading}
                              className="p-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Previous month"
                            >
                              {monthLoading ? (
                                <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                              )}
                            </button>
                          
                          <div className="px-4 py-2 bg-white border border-gray-200 rounded-lg min-w-[140px] text-center">
                            {monthLoading ? (
                              <div className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="font-medium text-blue-600">Loading...</span>
                              </div>
                            ) : (
                              <span className="font-medium text-gray-900">{formatMonthYear(currentMonth)}</span>
                            )}
                          </div>
                          
                            <button
                              onClick={() => navigateMonth('next')}
                              disabled={monthLoading}
                              className="p-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Next month"
                            >
                              {monthLoading ? (
                                <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </button>
                        </div>
                      </div>

                      {/* Month Overview - Quick Jump */}
                      {getMonthsWithAppointments().length > 1 && (
                        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="text-sm font-semibold text-blue-800 mb-3">📆 Quick Jump to Months with Appointments</h4>
                          <div className="flex flex-wrap gap-2">
                            {getMonthsWithAppointments().map(({ monthStr, date, count }) => (
                              <button
                                key={monthStr}
                                onClick={async () => {
                                  setCurrentMonth(date);
                                  setSelectedDate(null);
                                  await fetchAvailabilityForMonth(date);
                                }}
                                disabled={monthLoading}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  currentMonth.toISOString().slice(0, 7) === monthStr
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-100'
                                } ${monthLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {formatMonthYear(date)} ({count} slots)
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                        {/* Current Month Available Dates */}
                        {monthLoading ? (
                          <div className="text-center py-8 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </div>
                            <p className="text-blue-600 font-medium">Loading {formatMonthYear(currentMonth)}...</p>
                            <p className="text-sm text-blue-500 mt-1">Fetching appointment availability</p>
                          </div>
                        ) : getAvailableDatesForMonth(currentMonth).length === 0 ? (
                          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <p className="text-gray-600 font-medium">No appointments in {formatMonthYear(currentMonth)}</p>
                            <p className="text-sm text-gray-500 mt-1">Try navigating to another month</p>
                          </div>
                        ) : (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-sm text-gray-600">
                              {getAvailableDatesForMonth(currentMonth).length} date{getAvailableDatesForMonth(currentMonth).length !== 1 ? 's' : ''} with appointments in {formatMonthYear(currentMonth)}
                            </span>
                          </div>
                          
                          {/* Date Selection Grid for Current Month */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                            {getAvailableDatesForMonth(currentMonth).map((availableDate) => (
                              <button
                                key={availableDate.date}
                                onClick={() => handleDateSelect(availableDate.date)}
                                className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                                  selectedDate === availableDate.date
                                    ? 'border-blue-500 bg-blue-50 shadow-md'
                                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-gray-900">{formatDate(availableDate.date)}</p>
                                    <p className="text-sm text-gray-600">
                                      {availableDate.count} slot{availableDate.count !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                  <div className={`w-3 h-3 rounded-full ${
                                    selectedDate === availableDate.date ? 'bg-blue-500' : 'bg-gray-300'
                                  }`}></div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Time Slots for Selected Date */}
                      {selectedDate && (
                        <div className="border-t border-gray-200 pt-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-semibold text-gray-800">
                              🕐 Available Times for {formatDate(selectedDate)}
                            </h4>
                            <span className="text-sm text-gray-500">
                              {getSlotsForSelectedDate(result.slots, selectedDate).length} time slot{getSlotsForSelectedDate(result.slots, selectedDate).length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          {getSlotsForSelectedDate(result.slots, selectedDate).length === 0 ? (
                            <div className="text-center py-8">
                              <p className="text-gray-500">No time slots found for this date.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {getSlotsForSelectedDate(result.slots, selectedDate).map((slot, index) => (
                                <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-blue-600 font-semibold">
                                          {slot.time}
                                        </span>
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-900">{slot.time}</p>
                                        {slot.doctor && (
                                          <p className="text-sm text-gray-600">👨‍⚕️ {slot.doctor}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                        Available
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Raw Data Section */}
                  {result.rawData && (
                    <div className="border-t border-gray-200 pt-6">
                      <details className="group">
                        <summary className="cursor-pointer flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <span className="font-medium text-gray-700">
                            🔍 Raw API Data ({Array.isArray(result.rawData) ? result.rawData.length : 0} responses)
                          </span>
                          <svg className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="mt-4 bg-gray-900 rounded-lg overflow-hidden">
                          <pre className="p-4 text-green-400 text-xs overflow-auto max-h-96">
                            {JSON.stringify(result.rawData, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Status Card */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 System Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Node.js Version</span>
                  <span className="text-sm font-medium text-green-600">18.20.8</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Playwright</span>
                  <span className="text-sm font-medium text-green-600">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Proxy Support</span>
                  <span className="text-sm font-medium text-blue-600">Available</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Cache TTL</span>
                  <span className="text-sm font-medium text-gray-600">5 minutes</span>
                </div>
              </div>
            </div>

            {/* Features Card */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">✨ Features</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  Real-time scraping
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  XHR interception
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  Doctor mapping
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  In-memory caching
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  Proxy rotation
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  Error handling
                </li>
              </ul>
            </div>

            {/* MVP Notes */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-3">📝 MVP Notes</h3>
              <ul className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>Proof-of-concept for client demonstration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>5-minute in-memory caching</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>No database - ephemeral results</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>Manual triggering only</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>For demo purposes only</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>Slot availability is not 100% synced in thsi MVP</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Loader2, AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import { SmartsheetImportRow, fetchSmartsheetSheets, fetchAndParseSmartsheet } from '../lib/smartsheetImporter';

interface SmartsheetImportModalProps {
  token: string;
  onClose: () => void;
  onImport: (rows: SmartsheetImportRow[]) => void;
}

export const SmartsheetImportModal: React.FC<SmartsheetImportModalProps> = ({
  token,
  onClose,
  onImport,
}) => {
  const [step, setStep] = useState<'sheets' | 'preview'>('sheets');
  const [sheets, setSheets] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<number | null>(null);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [rows, setRows] = useState<SmartsheetImportRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<SmartsheetImportRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');

  // Load sheets on mount
  useEffect(() => {
    const loadSheets = async () => {
      setIsLoadingSheets(true);
      setErrorMessage('');
      try {
        const data = await fetchSmartsheetSheets(token);
        setSheets(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load Smartsheet sheets'
        );
      } finally {
        setIsLoadingSheets(false);
      }
    };
    loadSheets();
  }, [token]);

  // Load sheet rows when selected
  const handleSelectSheet = async (sheetId: number) => {
    setSelectedSheetId(sheetId);
    setIsLoadingRows(true);
    setErrorMessage('');
    try {
      const data = await fetchAndParseSmartsheet(token, sheetId);
      setRows(data);
      setFilteredRows(data);
      setStatusFilter('');
      setStep('preview');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load Smartsheet rows'
      );
      setSelectedSheetId(null);
    } finally {
      setIsLoadingRows(false);
    }
  };

  // Filter by status
  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    if (status === '') {
      setFilteredRows(rows);
    } else {
      setFilteredRows(rows.filter((r) => r.status === status));
    }
  };

  // Get unique statuses
  const uniqueStatuses = Array.from(new Set(rows.map((r) => r.status).filter(Boolean)));

  const handleImport = () => {
    onImport(filteredRows);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">
              {step === 'sheets' ? 'Select Smartsheet' : 'Preview & Import'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {errorMessage}
            </div>
          )}

          {step === 'sheets' && (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Select a Smartsheet to import requirements:
              </p>
              {isLoadingSheets ? (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  <span className="text-slate-600">Loading sheets...</span>
                </div>
              ) : sheets.length === 0 ? (
                <p className="text-slate-500 text-sm">No sheets found</p>
              ) : (
                <div className="space-y-2">
                  {sheets.map((sheet) => (
                    <button
                      key={sheet.id}
                      onClick={() => handleSelectSheet(sheet.id)}
                      disabled={isLoadingRows}
                      className="w-full p-3 text-left border border-slate-200 rounded hover:bg-indigo-50 hover:border-indigo-300 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between group"
                    >
                      <span className="text-slate-800 font-medium">{sheet.name}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">
                    Found <strong>{rows.length}</strong> rows
                    {statusFilter && ` (showing ${filteredRows.length} with status "${statusFilter}")`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setStep('sheets');
                    setSelectedSheetId(null);
                    setRows([]);
                    setFilteredRows([]);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Choose different sheet
                </button>
              </div>

              {uniqueStatuses.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-600">Filter by Status:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusFilterChange(e.target.value)}
                    className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                  >
                    <option value="">All</option>
                    {uniqueStatuses.map((status) => (
                      <option key={status} value={status || ''}>
                        {status || 'No status'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border border-slate-200 rounded overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">
                        Title
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 w-20">
                        Priority
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200 w-20">
                        Complexity
                      </th>
                      <th className="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200 w-16">
                        Est.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-200 hover:bg-slate-50 transition"
                      >
                        <td className="px-3 py-2">
                          <div>
                            <p className="font-medium text-slate-800">{row.title}</p>
                            {row.description && (
                              <p className="text-slate-500 truncate">{row.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{row.priority || '-'}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.complexity === 'Low'
                                ? 'bg-green-100 text-green-700'
                                : row.complexity === 'Medium'
                                ? 'bg-blue-100 text-blue-700'
                                : row.complexity === 'High'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {row.complexity.charAt(0)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600">
                          {row.estimate ? `${row.estimate}h` : '-'}
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                          No rows found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          {step === 'preview' && (
            <p className="text-xs text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 inline mr-1" />
              Ready to import {filteredRows.length} task
              {filteredRows.length !== 1 ? 's' : ''}
            </p>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={filteredRows.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import Tasks
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

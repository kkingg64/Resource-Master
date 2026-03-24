/**
 * Smartsheet API Integration
 * Fetches requirements from Smartsheet and converts to OMS task structure
 */

export interface SmartsheetSheet {
  id: number;
  name: string;
}

export interface SmartsheetRow {
  id: number;
  cells: Array<{ columnId: number; value: string | number | boolean | null }>;
}

export interface SmartsheetColumn {
  id: number;
  title: string;
  type: string;
}

export interface SmartsheetImportRow {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  assignee?: string;
  estimate?: number;
  complexity?: 'Low' | 'Medium' | 'High' | 'Complex';
}

/**
 * Fetch user's Smartsheet sheets
 */
export const fetchSmartsheetSheets = async (token: string): Promise<SmartsheetSheet[]> => {
  try {
    const accessToken = token.trim();
    const response = await fetch('/api/smartsheet/sheets', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Smartsheet API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch Smartsheet sheets:', error);
    throw error;
  }
};

/**
 * Fetch full sheet details with columns and rows
 */
export const fetchSmartsheetSheet = async (
  token: string,
  sheetId: number
): Promise<{ columns: SmartsheetColumn[]; rows: SmartsheetRow[] }> => {
  try {
    const accessToken = token.trim();
    const response = await fetch(`/api/smartsheet/sheets/${sheetId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Smartsheet API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return {
      columns: data.columns || [],
      rows: data.rows || [],
    };
  } catch (error) {
    console.error('Failed to fetch Smartsheet sheet details:', error);
    throw error;
  }
};

/**
 * Parse Smartsheet rows into OMS import format
 * Auto-detects common column names (title, description, priority, etc.)
 */
export const parseSmartsheetRows = (
  columns: SmartsheetColumn[],
  rows: SmartsheetRow[]
): SmartsheetImportRow[] => {
  // Build column index map
  const columnMap = new Map<string, number>();
  const columnTypeMap = new Map<number, string>();

  columns.forEach((col) => {
    const lowerTitle = col.title.toLowerCase();
    columnTypeMap.set(col.id, col.type);

    // Match common column names
    if (
      lowerTitle.includes('title') ||
      lowerTitle.includes('name') ||
      lowerTitle.includes('task') ||
      lowerTitle.includes('requirement')
    ) {
      columnMap.set('title', col.id);
    } else if (
      lowerTitle.includes('description') ||
      lowerTitle.includes('details') ||
      lowerTitle.includes('notes')
    ) {
      columnMap.set('description', col.id);
    } else if (lowerTitle.includes('priority')) {
      columnMap.set('priority', col.id);
    } else if (
      lowerTitle.includes('status') ||
      lowerTitle.includes('state')
    ) {
      columnMap.set('status', col.id);
    } else if (
      lowerTitle.includes('assignee') ||
      lowerTitle.includes('owner') ||
      lowerTitle.includes('assigned')
    ) {
      columnMap.set('assignee', col.id);
    } else if (
      lowerTitle.includes('estimate') ||
      lowerTitle.includes('points') ||
      lowerTitle.includes('effort')
    ) {
      columnMap.set('estimate', col.id);
    } else if (
      lowerTitle.includes('complexity') ||
      lowerTitle.includes('difficulty')
    ) {
      columnMap.set('complexity', col.id);
    }
  });

  // Parse rows
  const parsedRows = rows
    .map((row) => {
      const cellMap = new Map<number, any>();
      row.cells?.forEach((cell) => {
        cellMap.set(cell.columnId, cell.value);
      });

      const title = cellMap.get(columnMap.get('title'))?.toString().trim();
      if (!title) return null; // Skip rows without title

      const description = cellMap.get(columnMap.get('description'))?.toString().trim();
      const priority = cellMap.get(columnMap.get('priority'))?.toString().trim();
      const status = cellMap.get(columnMap.get('status'))?.toString().trim();
      const assignee = cellMap.get(columnMap.get('assignee'))?.toString().trim();
      const estimate = parseInt(
        cellMap.get(columnMap.get('estimate'))?.toString() || '0',
        10
      );
      let complexity = (cellMap
        .get(columnMap.get('complexity'))
        ?.toString()
        .trim() || 'Medium') as SmartsheetImportRow['complexity'];

      // Normalize complexity
      const normalizedComplexity = ['Low', 'Medium', 'High', 'Complex'].find(
        (c) => c.toLowerCase() === complexity.toLowerCase()
      );
      if (normalizedComplexity) {
        complexity = normalizedComplexity as SmartsheetImportRow['complexity'];
      }

      return {
        title,
        description: description || undefined,
        priority: priority || undefined,
        status: status || undefined,
        assignee: assignee || undefined,
        estimate: estimate || undefined,
        complexity: complexity || 'Medium',
      };
    })
    .filter((row) => row !== null);

  return parsedRows as SmartsheetImportRow[];
};

/**
 * High-level: fetch sheet and parse to import rows
 */
export const fetchAndParseSmartsheet = async (
  token: string,
  sheetId: number
): Promise<SmartsheetImportRow[]> => {
  const { columns, rows } = await fetchSmartsheetSheet(token, sheetId);
  return parseSmartsheetRows(columns, rows);
};

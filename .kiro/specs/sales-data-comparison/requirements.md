# Requirements Document

## Introduction

本系统是一个销售数据整理与对比分析网页应用。用户可以导入多个月份的Excel销售数据，系统自动按品类分组、按销售金额排序，并以不同颜色区域展示各月份数据。支持跨月份商品销售趋势对比（K线图风格），以及按月份、品类、商品名称的模糊搜索功能。系统支持数据本地存储，再次打开可直接展示已保存的数据，并支持删除和重新上传某月份数据。

## Glossary

- **Sales_Data_Comparator**: 销售数据对比系统，本应用的核心系统名称
- **XLS文档**: Excel格式的销售数据文件（支持.xls和.xlsx格式）
- **品类**: 商品所属的分类类别
- **销售金额**: 商品的销售总额数值
- **销售数量**: 商品的销售件数
- **K线图**: 类似股票走势的数据可视化图表，用于展示商品跨月份销售趋势
- **月份区域**: 以不同背景颜色区分的数据展示区块，每个区块代表一个月份的数据
- **本地存储**: 使用浏览器localStorage保存数据，实现数据持久化

## Requirements

### Requirement 1

**User Story:** As a 数据分析人员, I want to 导入Excel销售数据并选择需要的列, so that 我可以只关注重要的数据字段。

#### Acceptance Criteria

1. WHEN a user uploads an XLS or XLSX file THEN the Sales_Data_Comparator SHALL parse the file and display all column names as selectable checkboxes
2. WHEN a user selects columns and confirms THEN the Sales_Data_Comparator SHALL filter the data to include only the selected columns
3. IF the uploaded file is not a valid Excel format THEN the Sales_Data_Comparator SHALL display an error message indicating the file format is invalid
4. WHEN the file contains no data rows THEN the Sales_Data_Comparator SHALL display a message indicating the file is empty

### Requirement 2

**User Story:** As a 数据分析人员, I want to 自动按品类分组并按销售金额排序, so that 我可以快速查看同类商品的销售表现。

#### Acceptance Criteria

1. WHEN data is imported and columns are selected THEN the Sales_Data_Comparator SHALL group products by the category column
2. WHEN products are grouped by category THEN the Sales_Data_Comparator SHALL sort products within each category by sales amount in descending order
3. WHEN the category column is not present in selected columns THEN the Sales_Data_Comparator SHALL prompt the user to select a category column
4. WHEN the sales amount column is not present in selected columns THEN the Sales_Data_Comparator SHALL prompt the user to select a sales amount column
5. WHEN the sales quantity column is not present in selected columns THEN the Sales_Data_Comparator SHALL prompt the user to select a sales quantity column

### Requirement 3

**User Story:** As a 数据分析人员, I want to 导入多个月份的数据并以不同颜色区域展示, so that 我可以直观区分不同月份的销售数据。

#### Acceptance Criteria

1. WHEN a user imports additional monthly data THEN the Sales_Data_Comparator SHALL display the new data in a separate colored region adjacent to existing data
2. WHEN multiple months of data are displayed THEN the Sales_Data_Comparator SHALL label each region with the corresponding month name at the top
3. WHEN a new month is imported THEN the Sales_Data_Comparator SHALL assign a distinct background color that differs from all previously used colors
4. WHEN importing data THEN the Sales_Data_Comparator SHALL prompt the user to specify the month for the imported data
5. WHEN displaying product information THEN the Sales_Data_Comparator SHALL show product name, sales quantity, and sales amount in order

### Requirement 4

**User Story:** As a 数据分析人员, I want to 点击商品名称查看跨月份销售趋势图, so that 我可以分析商品的销售变化趋势。

#### Acceptance Criteria

1. WHEN two or more months of data are imported AND a user clicks on a product name THEN the Sales_Data_Comparator SHALL search for the same product name across all imported months
2. WHEN matching products are found across months THEN the Sales_Data_Comparator SHALL display a K-line style chart showing sales amount trends over time
3. WHEN a product exists in only one month THEN the Sales_Data_Comparator SHALL display a message indicating insufficient data for trend comparison
4. WHEN the trend chart is displayed THEN the Sales_Data_Comparator SHALL show month labels on the X-axis and sales amounts on the Y-axis

### Requirement 5

**User Story:** As a 数据分析人员, I want to 通过搜索栏按月份、品类、商品名称搜索数据, so that 我可以快速定位特定的销售记录。

#### Acceptance Criteria

1. WHEN a user enters a search term THEN the Sales_Data_Comparator SHALL filter displayed data to show only matching records
2. WHEN searching by month THEN the Sales_Data_Comparator SHALL match records from the specified month
3. WHEN searching by category THEN the Sales_Data_Comparator SHALL match records where the category contains the search term (fuzzy match)
4. WHEN searching by product name THEN the Sales_Data_Comparator SHALL match records where the product name contains the search term (fuzzy match)
5. WHEN the search field is cleared THEN the Sales_Data_Comparator SHALL restore the display to show all imported data

### Requirement 6

**User Story:** As a 数据分析人员, I want to 自动保存整理后的数据到本地存储, so that 再次打开页面时可以直接查看之前的数据。

#### Acceptance Criteria

1. WHEN data is imported and processed THEN the Sales_Data_Comparator SHALL persist the data to browser localStorage immediately
2. WHEN the application loads THEN the Sales_Data_Comparator SHALL retrieve and display previously saved data from localStorage
3. WHEN data changes occur (import or delete) THEN the Sales_Data_Comparator SHALL update the localStorage to reflect current state

### Requirement 7

**User Story:** As a 数据分析人员, I want to 删除某个月份的数据并重新上传, so that 我可以更正错误的数据或更新过期的数据。

#### Acceptance Criteria

1. WHEN a user clicks the delete button on a month region THEN the Sales_Data_Comparator SHALL remove that month's data from display and storage
2. WHEN a month is deleted THEN the Sales_Data_Comparator SHALL update localStorage to remove the deleted month's data
3. WHEN a month is deleted THEN the Sales_Data_Comparator SHALL allow the user to re-import data for that month
4. WHEN deleting a month THEN the Sales_Data_Comparator SHALL display a confirmation prompt before deletion

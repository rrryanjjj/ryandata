/**
 * 数据路由 - 销售数据 API
 * Requirements: 2.3, 4.1, 4.2, 4.4
 */

const express = require('express');
const router = express.Router();
const { query, queryOne, run } = require('../db');
const authMiddleware = require('../middleware/auth');

// 所有数据路由都需要认证
router.use(authMiddleware);

/**
 * GET /api/data - 获取用户所有销售数据
 * Requirements: 2.3, 4.4
 * 
 * 返回当前登录用户的所有销售数据
 */
router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    
    const salesData = query(
      `SELECT id, month_id, month_name, color, config, grouped_data, raw_data, created_at, updated_at 
       FROM sales_data 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    // 解析 JSON 字段
    const parsedData = salesData.map(item => ({
      id: item.id,
      monthId: item.month_id,
      monthName: item.month_name,
      color: item.color,
      config: JSON.parse(item.config || '{}'),
      groupedData: JSON.parse(item.grouped_data || '[]'),
      rawData: JSON.parse(item.raw_data || '[]'),
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
    
    res.json({
      success: true,
      data: parsedData
    });
  } catch (error) {
    console.error('获取数据错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});


/**
 * POST /api/data - 上传月度销售数据
 * Requirements: 4.1
 * 
 * 保存月度销售数据到数据库
 * 如果相同 month_id 已存在，则更新数据
 */
router.post('/', (req, res) => {
  try {
    const userId = req.user.id;
    const { monthId, monthName, color, config, groupedData, rawData } = req.body;
    
    // 验证必填字段
    if (!monthId || typeof monthId !== 'string') {
      return res.status(400).json({
        success: false,
        error: '月份ID不能为空'
      });
    }
    
    if (!monthName || typeof monthName !== 'string') {
      return res.status(400).json({
        success: false,
        error: '月份名称不能为空'
      });
    }
    
    // 检查是否已存在相同月份的数据
    const existingData = queryOne(
      'SELECT id FROM sales_data WHERE user_id = ? AND month_id = ?',
      [userId, monthId]
    );
    
    const configJson = JSON.stringify(config || {});
    const groupedDataJson = JSON.stringify(groupedData || []);
    const rawDataJson = JSON.stringify(rawData || []);
    const colorValue = color || '#4A90A4';
    
    let result;
    
    if (existingData) {
      // 更新现有数据
      run(
        `UPDATE sales_data 
         SET month_name = ?, color = ?, config = ?, grouped_data = ?, raw_data = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [monthName, colorValue, configJson, groupedDataJson, rawDataJson, existingData.id]
      );
      result = { id: existingData.id };
    } else {
      // 插入新数据
      const insertResult = run(
        `INSERT INTO sales_data (user_id, month_id, month_name, color, config, grouped_data, raw_data) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, monthId, monthName, colorValue, configJson, groupedDataJson, rawDataJson]
      );
      result = { id: insertResult.lastInsertRowid };
    }
    
    res.status(existingData ? 200 : 201).json({
      success: true,
      id: result.id
    });
  } catch (error) {
    console.error('上传数据错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});


/**
 * DELETE /api/data/:id - 删除月度销售数据
 * Requirements: 4.2
 * 
 * 删除指定的月度数据
 * 只能删除当前用户自己的数据
 */
router.delete('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const dataId = parseInt(req.params.id, 10);
    
    if (isNaN(dataId)) {
      return res.status(400).json({
        success: false,
        error: '无效的数据ID'
      });
    }
    
    // 检查数据是否存在且属于当前用户
    const existingData = queryOne(
      'SELECT id FROM sales_data WHERE id = ? AND user_id = ?',
      [dataId, userId]
    );
    
    if (!existingData) {
      return res.status(404).json({
        success: false,
        error: '数据不存在或无权限删除'
      });
    }
    
    // 删除数据
    run('DELETE FROM sales_data WHERE id = ?', [dataId]);
    
    res.json({
      success: true
    });
  } catch (error) {
    console.error('删除数据错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
});

module.exports = router;

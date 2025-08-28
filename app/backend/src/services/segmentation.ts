/**
 * Segmentation Engine
 * Advanced subscriber segmentation with rule-based filtering
 */

import { PrismaClient, Subscriber, SubscriberStatus, SubscriberDeviceType } from '@prisma/client'
import { z } from 'zod'
import { logger } from '@/utils/logger'

// Segmentation rule operators
export enum SegmentOperator {
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT'
}

export enum FieldOperator {
  EQUALS = '=',
  NOT_EQUALS = '!=',
  IN = 'IN',
  NOT_IN = 'NOT_IN',
  GREATER_THAN = '>',
  GREATER_THAN_OR_EQUAL = '>=',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUAL = '<=',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
  STARTS_WITH = 'STARTS_WITH',
  ENDS_WITH = 'ENDS_WITH',
  MATCHES = 'MATCHES', // Regex or glob pattern
  EXISTS = 'EXISTS',
  NOT_EXISTS = 'NOT_EXISTS',
  IS_EMPTY = 'IS_EMPTY',
  IS_NOT_EMPTY = 'IS_NOT_EMPTY'
}

// Field rule schema
const fieldRuleSchema = z.object({
  field: z.string(),
  operator: z.nativeEnum(FieldOperator),
  value: z.any().optional(),
  values: z.array(z.any()).optional()
})

// Segment rule schema (recursive for nested AND/OR)
const segmentRuleSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    // Field rule
    fieldRuleSchema,
    // Logic rule
    z.object({
      operator: z.nativeEnum(SegmentOperator),
      rules: z.array(segmentRuleSchema)
    })
  ])
)

// Complete segment definition schema
export const segmentDefinitionSchema = z.object({
  operator: z.nativeEnum(SegmentOperator).optional().default(SegmentOperator.AND),
  rules: z.array(segmentRuleSchema)
})

export type FieldRule = z.infer<typeof fieldRuleSchema>
export type SegmentRule = z.infer<typeof segmentRuleSchema>
export type SegmentDefinition = z.infer<typeof segmentDefinitionSchema>

// Available fields for segmentation
export const segmentableFields = {
  // Device & Browser
  'device.type': { type: 'enum', values: Object.values(SubscriberDeviceType) },
  'device.name': { type: 'string' },
  'browser.name': { type: 'string' },
  'browser.version': { type: 'string' },
  'os.name': { type: 'string' },
  'os.version': { type: 'string' },
  
  // Location
  'geo.country': { type: 'string' },
  'geo.region': { type: 'string' },
  'geo.city': { type: 'string' },
  'geo.timezone': { type: 'string' },
  'locale': { type: 'string' },
  
  // Behavior
  'first_seen': { type: 'datetime' },
  'last_seen': { type: 'datetime' },
  'first_seen_days_ago': { type: 'number' },
  'last_seen_days_ago': { type: 'number' },
  'page_views': { type: 'number' },
  'status': { type: 'enum', values: Object.values(SubscriberStatus) },
  
  // Tags & Custom Data
  'tags': { type: 'array' },
  'has_tag': { type: 'string' },
  'metadata': { type: 'json' },
  
  // Event-based (requires join with events table)
  'events.clicked_campaign': { type: 'string' },
  'events.last_click_days_ago': { type: 'number' },
  'events.total_clicks': { type: 'number' },
  'events.has_opened': { type: 'boolean' },
  'events.engagement_score': { type: 'number' },
  
  // Time-based
  'hour_of_day': { type: 'number', min: 0, max: 23 },
  'day_of_week': { type: 'number', min: 0, max: 6 }, // 0 = Sunday
  'is_weekend': { type: 'boolean' },
  'local_time': { type: 'time' },
}

export class SegmentationEngine {
  constructor(private prisma: PrismaClient) {}

  /**
   * Evaluate segment definition and return matching subscriber IDs
   */
  async evaluateSegment(
    projectId: string,
    definition: SegmentDefinition
  ): Promise<string[]> {
    try {
      // Validate segment definition
      const validatedDefinition = segmentDefinitionSchema.parse(definition)
      
      // Build SQL query from segment rules
      const { sql, params } = this.buildSegmentQuery(projectId, validatedDefinition)
      
      logger.debug({ sql, params }, 'Executing segment query')
      
      // Execute the query
      const results = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(sql, ...params)
      
      const subscriberIds = results.map(r => r.id)
      
      logger.info({
        projectId,
        segmentRules: validatedDefinition.rules.length,
        matchingSubscribers: subscriberIds.length
      }, 'Segment evaluation completed')
      
      return subscriberIds
      
    } catch (error) {
      logger.error({ error, projectId, definition }, 'Segment evaluation failed')
      throw new Error(`Segment evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Count subscribers matching a segment
   */
  async countSegment(
    projectId: string,
    definition: SegmentDefinition
  ): Promise<number> {
    try {
      const validatedDefinition = segmentDefinitionSchema.parse(definition)
      const { sql, params } = this.buildSegmentQuery(projectId, validatedDefinition, true)
      
      const results = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(sql, ...params)
      return Number(results[0]?.count || 0)
    } catch (error) {
      logger.error({ error, projectId, definition }, 'Segment count failed')
      return 0
    }
  }

  /**
   * Build SQL query from segment definition
   */
  private buildSegmentQuery(
    projectId: string,
    definition: SegmentDefinition,
    countOnly: boolean = false
  ): { sql: string; params: any[] } {
    const params: any[] = [projectId]
    let paramIndex = 1

    // Base query
    const selectClause = countOnly ? 'COUNT(*)' : 's.id'
    let sql = `
      SELECT ${selectClause}
      FROM subscribers s
      WHERE s.project_id = $${paramIndex++}
        AND s.status = 'ACTIVE'
    `

    // Add segment conditions
    if (definition.rules && definition.rules.length > 0) {
      const { condition, newParams } = this.buildConditions(
        definition.operator || SegmentOperator.AND,
        definition.rules,
        paramIndex
      )
      
      sql += ` AND (${condition})`
      params.push(...newParams)
    }

    // Add ordering for non-count queries
    if (!countOnly) {
      sql += ' ORDER BY s.last_seen DESC'
    }

    return { sql, params }
  }

  /**
   * Recursively build WHERE conditions from segment rules
   */
  private buildConditions(
    operator: SegmentOperator,
    rules: SegmentRule[],
    startParamIndex: number
  ): { condition: string; newParams: any[] } {
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = startParamIndex

    for (const rule of rules) {
      if ('operator' in rule && rule.operator in SegmentOperator) {
        // Nested logic rule
        const { condition, newParams } = this.buildConditions(
          rule.operator as SegmentOperator,
          rule.rules,
          paramIndex
        )
        conditions.push(`(${condition})`)
        params.push(...newParams)
        paramIndex += newParams.length
      } else {
        // Field rule
        const fieldRule = rule as FieldRule
        const { condition, newParams } = this.buildFieldCondition(
          fieldRule,
          paramIndex
        )
        conditions.push(condition)
        params.push(...newParams)
        paramIndex += newParams.length
      }
    }

    // Combine conditions with operator
    let finalCondition: string
    if (operator === SegmentOperator.NOT) {
      finalCondition = `NOT (${conditions.join(' OR ')})`
    } else {
      const joinOperator = operator === SegmentOperator.AND ? ' AND ' : ' OR '
      finalCondition = conditions.join(joinOperator)
    }

    return {
      condition: finalCondition,
      newParams: params
    }
  }

  /**
   * Build SQL condition for a single field rule
   */
  private buildFieldCondition(
    rule: FieldRule,
    paramIndex: number
  ): { condition: string; newParams: any[] } {
    const { field, operator, value, values } = rule
    const params: any[] = []

    // Map field names to SQL expressions
    const fieldMapping = this.getFieldMapping(field)
    if (!fieldMapping) {
      throw new Error(`Unknown field: ${field}`)
    }

    const sqlField = fieldMapping.sql
    let condition: string

    switch (operator) {
      case FieldOperator.EQUALS:
        condition = `${sqlField} = $${paramIndex}`
        params.push(value)
        break

      case FieldOperator.NOT_EQUALS:
        condition = `${sqlField} != $${paramIndex}`
        params.push(value)
        break

      case FieldOperator.IN:
        const inValues = values || (Array.isArray(value) ? value : [value])
        const inPlaceholders = inValues.map((_, i) => `$${paramIndex + i}`).join(',')
        condition = `${sqlField} IN (${inPlaceholders})`
        params.push(...inValues)
        break

      case FieldOperator.NOT_IN:
        const notInValues = values || (Array.isArray(value) ? value : [value])
        const notInPlaceholders = notInValues.map((_, i) => `$${paramIndex + i}`).join(',')
        condition = `${sqlField} NOT IN (${notInPlaceholders})`
        params.push(...notInValues)
        break

      case FieldOperator.GREATER_THAN:
        condition = `${sqlField} > $${paramIndex}`
        params.push(value)
        break

      case FieldOperator.GREATER_THAN_OR_EQUAL:
        condition = `${sqlField} >= $${paramIndex}`
        params.push(value)
        break

      case FieldOperator.LESS_THAN:
        condition = `${sqlField} < $${paramIndex}`
        params.push(value)
        break

      case FieldOperator.LESS_THAN_OR_EQUAL:
        condition = `${sqlField} <= $${paramIndex}`
        params.push(value)
        break

      case FieldOperator.CONTAINS:
        condition = `${sqlField} ILIKE $${paramIndex}`
        params.push(`%${value}%`)
        break

      case FieldOperator.NOT_CONTAINS:
        condition = `${sqlField} NOT ILIKE $${paramIndex}`
        params.push(`%${value}%`)
        break

      case FieldOperator.STARTS_WITH:
        condition = `${sqlField} ILIKE $${paramIndex}`
        params.push(`${value}%`)
        break

      case FieldOperator.ENDS_WITH:
        condition = `${sqlField} ILIKE $${paramIndex}`
        params.push(`%${value}`)
        break

      case FieldOperator.MATCHES:
        // Support both regex and glob patterns
        if (value.includes('*') || value.includes('?')) {
          // Glob pattern - convert to SQL LIKE
          const likePattern = value.replace(/\*/g, '%').replace(/\?/g, '_')
          condition = `${sqlField} ILIKE $${paramIndex}`
          params.push(likePattern)
        } else {
          // Regex pattern
          condition = `${sqlField} ~ $${paramIndex}`
          params.push(value)
        }
        break

      case FieldOperator.EXISTS:
        condition = `${sqlField} IS NOT NULL`
        break

      case FieldOperator.NOT_EXISTS:
        condition = `${sqlField} IS NULL`
        break

      case FieldOperator.IS_EMPTY:
        if (fieldMapping.type === 'array') {
          condition = `(${sqlField} IS NULL OR array_length(${sqlField}, 1) IS NULL)`
        } else {
          condition = `(${sqlField} IS NULL OR ${sqlField} = '')`
        }
        break

      case FieldOperator.IS_NOT_EMPTY:
        if (fieldMapping.type === 'array') {
          condition = `(${sqlField} IS NOT NULL AND array_length(${sqlField}, 1) > 0)`
        } else {
          condition = `(${sqlField} IS NOT NULL AND ${sqlField} != '')`
        }
        break

      default:
        throw new Error(`Unsupported operator: ${operator}`)
    }

    return { condition, newParams: params }
  }

  /**
   * Get SQL field mapping for segment field names
   */
  private getFieldMapping(field: string): { sql: string; type: string } | null {
    const mappings: Record<string, { sql: string; type: string }> = {
      // Device & Browser
      'device.type': { sql: 's.device_type', type: 'enum' },
      'device.name': { sql: 's.device', type: 'string' },
      'browser.name': { sql: 's.browser', type: 'string' },
      'browser.version': { sql: 's.browser_version', type: 'string' },
      'os.name': { sql: 's.os', type: 'string' },
      'os.version': { sql: 's.os_version', type: 'string' },

      // Location
      'geo.country': { sql: 's.country', type: 'string' },
      'geo.region': { sql: 's.region', type: 'string' },
      'geo.city': { sql: 's.city', type: 'string' },
      'geo.timezone': { sql: 's.timezone', type: 'string' },
      'locale': { sql: 's.locale', type: 'string' },

      // Behavior
      'first_seen': { sql: 's.first_seen', type: 'datetime' },
      'last_seen': { sql: 's.last_seen', type: 'datetime' },
      'first_seen_days_ago': { sql: 'EXTRACT(DAY FROM NOW() - s.first_seen)', type: 'number' },
      'last_seen_days_ago': { sql: 'EXTRACT(DAY FROM NOW() - s.last_seen)', type: 'number' },
      'page_views': { sql: 's.page_views', type: 'number' },
      'status': { sql: 's.status', type: 'enum' },

      // Tags & Metadata
      'tags': { sql: 's.tags', type: 'array' },
      'has_tag': { sql: '$1 = ANY(s.tags)', type: 'array_contains' },
      
      // Time-based (requires timezone conversion)
      'hour_of_day': { 
        sql: 'EXTRACT(HOUR FROM (s.last_seen AT TIME ZONE COALESCE(s.timezone, \'UTC\')))', 
        type: 'number' 
      },
      'day_of_week': { 
        sql: 'EXTRACT(DOW FROM (s.last_seen AT TIME ZONE COALESCE(s.timezone, \'UTC\')))', 
        type: 'number' 
      },
      'is_weekend': { 
        sql: 'EXTRACT(DOW FROM (s.last_seen AT TIME ZONE COALESCE(s.timezone, \'UTC\'))) IN (0, 6)', 
        type: 'boolean' 
      }
    }

    return mappings[field] || null
  }

  /**
   * Validate segment definition
   */
  validateSegment(definition: SegmentDefinition): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    try {
      segmentDefinitionSchema.parse(definition)
      
      // Additional validation for field names and values
      this.validateRules(definition.rules, errors)
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`))
      } else {
        errors.push('Invalid segment definition')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Recursively validate segment rules
   */
  private validateRules(rules: SegmentRule[], errors: string[]): void {
    for (const rule of rules) {
      if ('operator' in rule && rule.operator in SegmentOperator) {
        // Logic rule
        if (!rule.rules || rule.rules.length === 0) {
          errors.push('Logic rules must have at least one child rule')
        } else {
          this.validateRules(rule.rules, errors)
        }
      } else {
        // Field rule
        const fieldRule = rule as FieldRule
        
        // Check if field exists
        if (!this.getFieldMapping(fieldRule.field)) {
          errors.push(`Unknown field: ${fieldRule.field}`)
          continue
        }

        // Validate value requirements
        const requiresValue = ![
          FieldOperator.EXISTS,
          FieldOperator.NOT_EXISTS,
          FieldOperator.IS_EMPTY,
          FieldOperator.IS_NOT_EMPTY
        ].includes(fieldRule.operator)

        const requiresMultipleValues = [
          FieldOperator.IN,
          FieldOperator.NOT_IN
        ].includes(fieldRule.operator)

        if (requiresValue && !fieldRule.value && !fieldRule.values) {
          errors.push(`Field ${fieldRule.field} with operator ${fieldRule.operator} requires a value`)
        }

        if (requiresMultipleValues && !fieldRule.values && !Array.isArray(fieldRule.value)) {
          errors.push(`Field ${fieldRule.field} with operator ${fieldRule.operator} requires an array of values`)
        }
      }
    }
  }

  /**
   * Generate human-readable description of segment
   */
  describeSegment(definition: SegmentDefinition): string {
    return this.describeRules(definition.operator || SegmentOperator.AND, definition.rules)
  }

  private describeRules(operator: SegmentOperator, rules: SegmentRule[]): string {
    const descriptions = rules.map(rule => {
      if ('operator' in rule && rule.operator in SegmentOperator) {
        return `(${this.describeRules(rule.operator as SegmentOperator, rule.rules)})`
      } else {
        const fieldRule = rule as FieldRule
        return this.describeFieldRule(fieldRule)
      }
    })

    const joinWord = operator === SegmentOperator.AND ? ' AND ' : ' OR '
    const result = descriptions.join(joinWord)
    
    return operator === SegmentOperator.NOT ? `NOT (${result})` : result
  }

  private describeFieldRule(rule: FieldRule): string {
    const field = rule.field.replace(/\./g, ' ')
    const value = Array.isArray(rule.value) ? rule.value.join(', ') : rule.value
    const values = rule.values ? rule.values.join(', ') : null

    switch (rule.operator) {
      case FieldOperator.EQUALS:
        return `${field} equals "${value}"`
      case FieldOperator.NOT_EQUALS:
        return `${field} does not equal "${value}"`
      case FieldOperator.IN:
        return `${field} is one of [${values || value}]`
      case FieldOperator.NOT_IN:
        return `${field} is not one of [${values || value}]`
      case FieldOperator.GREATER_THAN:
        return `${field} is greater than ${value}`
      case FieldOperator.LESS_THAN:
        return `${field} is less than ${value}`
      case FieldOperator.CONTAINS:
        return `${field} contains "${value}"`
      case FieldOperator.MATCHES:
        return `${field} matches pattern "${value}"`
      case FieldOperator.EXISTS:
        return `${field} exists`
      case FieldOperator.NOT_EXISTS:
        return `${field} does not exist`
      default:
        return `${field} ${rule.operator} ${value}`
    }
  }
}

export default SegmentationEngine
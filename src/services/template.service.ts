import { prisma } from '../app';
import { Prisma } from '@prisma/client';

export class TemplateService {
  async createTemplate(data: {
    name: string;
    description?: string;
    stages: string[];
    transitions: Record<string, string[]>;
    permissions: Record<string, string[]>;
    createdById: number;
  }) {
    // Validate workflow graph
    this.validateWorkflowGraph(data.stages, data.transitions);
    this.validatePermissions(data.stages, data.permissions);

    return prisma.workflowTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        stages: data.stages,
        transitions: data.transitions,
        permissions: data.permissions,
        createdById: data.createdById
      }
    });
  }

  async getTemplate(id: number) {
    return prisma.workflowTemplate.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });
  }

  async getAllTemplates() {
    return prisma.workflowTemplate.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateTemplate(id: number, data: any, userId: number) {
    const template = await prisma.workflowTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Only creator can update
    if (template.createdById !== userId) {
      throw new Error('Only the creator can update this template');
    }

    // Validate if stages or transitions are being updated
    if (data.stages && data.transitions) {
      this.validateWorkflowGraph(data.stages, data.transitions);
    }
    if (data.stages && data.permissions) {
      this.validatePermissions(data.stages, data.permissions);
    }

    return prisma.workflowTemplate.update({
      where: { id },
      data: {
        ...data,
        version: { increment: 1 }
      }
    });
  }

  async deleteTemplate(id: number, userId: number) {
    const template = await prisma.workflowTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Only creator can delete
    if (template.createdById !== userId) {
      throw new Error('Only the creator can delete this template');
    }

    // Check if template is in use
    const items = await prisma.workflowItem.findMany({
      where: { templateId: id },
      take: 1
    });

    if (items.length > 0) {
      throw new Error('Cannot delete template with active workflow items');
    }

    return prisma.workflowTemplate.delete({
      where: { id }
    });
  }

  async getValidTransitions(templateId: number, currentStage: string) {
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      throw new Error('Template not found');
    }

    const transitions = template.transitions as Record<string, string[]>;
    return transitions[currentStage] || [];
  }

  private validateWorkflowGraph(stages: string[], transitions: Record<string, string[]>) {
    // Check all transition targets exist in stages
    for (const [from, toList] of Object.entries(transitions)) {
      if (!stages.includes(from)) {
        throw new Error(`Stage "${from}" in transitions not found in stages list`);
      }
      for (const to of toList) {
        if (!stages.includes(to)) {
          throw new Error(`Target stage "${to}" not found in stages list`);
        }
      }
    }

    // Check for cycles (DFS)
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      if (recursionStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recursionStack.add(node);

      const neighbors = transitions[node] || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) return true;
      }

      recursionStack.delete(node);
      return false;
    };

    for (const stage of stages) {
      if (!visited.has(stage)) {
        if (hasCycle(stage)) {
          throw new Error('Cyclic dependency detected in workflow');
        }
      }
    }
  }

  private validatePermissions(stages: string[], permissions: Record<string, string[]>) {
    for (const stage of stages) {
      if (permissions[stage] && !Array.isArray(permissions[stage])) {
        throw new Error(`Permissions for stage "${stage}" must be an array of roles`);
      }
    }
  }
}
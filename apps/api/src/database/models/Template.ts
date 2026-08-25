import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'Templates',
  timestamps: true,
})
export class Template extends Model<Template> {
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  userNumber: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  keyword: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  type: string;

  @Column({
    type: DataType.TEXT,
    defaultValue: '',
  })
  content: string;

  @Column({
    type: DataType.JSON,
    defaultValue: [],
  })
  buttons: any[];

  @Column({
    type: DataType.STRING,
    defaultValue: '',
  })
  footer: string;

  @Column({
    type: DataType.STRING,
    defaultValue: '',
  })
  header: string;

  @Column({
    type: DataType.JSON,
    defaultValue: [],
  })
  sections: any[];

  @Column({
    type: DataType.STRING,
    defaultValue: '',
  })
  mediaUrl: string;

  @Column({
    type: DataType.STRING,
    defaultValue: '',
  })
  fileName: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    defaultValue: DataType.NOW,
  })
  createdAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    defaultValue: DataType.NOW,
  })
  updatedAt: Date;
}
